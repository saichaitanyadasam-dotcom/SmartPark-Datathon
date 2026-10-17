from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
import io
import os
import sqlite3

import qrcode
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv("SMARTPARK_DB", BASE_DIR / "smartpark.db"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
HOURLY_RATE = float(os.getenv("PARKING_HOURLY_RATE", "30"))


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def init_db():
    with connect() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS slots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','occupied'))
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slot_id INTEGER NOT NULL REFERENCES slots(id),
            vehicle_number TEXT NOT NULL,
            started_at TEXT NOT NULL,
            ended_at TEXT,
            duration_minutes INTEGER,
            fee REAL,
            status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed'))
        )""")
        count = conn.execute("SELECT COUNT(*) FROM slots").fetchone()[0]
        if count == 0:
            conn.executemany("INSERT INTO slots(code, status) VALUES (?, 'available')",
                             [(f"P-{i:02d}",) for i in range(1, 13)])


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="SmartPark API", description="QR-based parking access, slot management, sessions and fee calculation.", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


class StartSession(BaseModel):
    slot_code: str
    vehicle_number: str = Field(min_length=2, max_length=20)


@app.get("/")
def root():
    return {"name": "SmartPark API", "status": "running", "docs": "/docs"}


@app.get("/api/slots")
def list_slots():
    with connect() as conn:
        rows = conn.execute("""SELECT s.id, s.code, s.status,
            (SELECT ss.id FROM sessions ss WHERE ss.slot_id=s.id AND ss.status='active' ORDER BY ss.id DESC LIMIT 1) AS active_session_id
            FROM slots s ORDER BY s.id""").fetchall()
    return [dict(row) for row in rows]


@app.get("/api/sessions/active")
def active_sessions():
    with connect() as conn:
        rows = conn.execute("""SELECT ss.id, ss.vehicle_number, ss.started_at, s.code AS slot_code
            FROM sessions ss JOIN slots s ON s.id=ss.slot_id
            WHERE ss.status='active' ORDER BY ss.started_at DESC""").fetchall()
    return [dict(row) for row in rows]


@app.post("/api/sessions")
def start_session(payload: StartSession):
    vehicle = payload.vehicle_number.strip().upper()
    if not vehicle:
        raise HTTPException(status_code=422, detail="Vehicle number is required")
    with connect() as conn:
        slot = conn.execute("SELECT * FROM slots WHERE code=?", (payload.slot_code.upper(),)).fetchone()
        if not slot:
            raise HTTPException(status_code=404, detail="Parking slot not found")
        if slot["status"] != "available":
            raise HTTPException(status_code=409, detail="This slot is already occupied. Please choose another.")
        started_at = now_iso()
        cursor = conn.execute("INSERT INTO sessions(slot_id, vehicle_number, started_at, status) VALUES (?, ?, ?, 'active')",
                              (slot["id"], vehicle, started_at))
        conn.execute("UPDATE slots SET status='occupied' WHERE id=?", (slot["id"],))
        session_id = cursor.lastrowid
    return {"id": session_id, "slot_code": slot["code"], "vehicle_number": vehicle, "started_at": started_at, "status": "active"}


@app.post("/api/sessions/{session_id}/end")
def end_session(session_id: int):
    with connect() as conn:
        session = conn.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="Parking session not found")
        if session["status"] != "active":
            raise HTTPException(status_code=409, detail="This session has already ended")
        started = datetime.fromisoformat(session["started_at"])
        ended = datetime.now(timezone.utc)
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        minutes = max(1, int((ended - started).total_seconds() // 60))
        # Charge by started hour, with a minimum charge of one hour.
        fee = round(max(1, (minutes + 59) // 60) * HOURLY_RATE, 2)
        conn.execute("UPDATE sessions SET ended_at=?, duration_minutes=?, fee=?, status='completed' WHERE id=?",
                     (ended.isoformat(), minutes, fee, session_id))
        conn.execute("UPDATE slots SET status='available' WHERE id=?", (session["slot_id"],))
        slot = conn.execute("SELECT code FROM slots WHERE id=?", (session["slot_id"],)).fetchone()
    return {"id": session_id, "slot_code": slot["code"], "vehicle_number": session["vehicle_number"],
            "started_at": session["started_at"], "ended_at": ended.isoformat(),
            "duration_minutes": minutes, "fee": fee, "currency": "INR", "status": "completed"}


@app.get("/api/admin/stats")
def admin_stats():
    with connect() as conn:
        total = conn.execute("SELECT COUNT(*) FROM slots").fetchone()[0]
        occupied = conn.execute("SELECT COUNT(*) FROM slots WHERE status='occupied'").fetchone()[0]
        active = conn.execute("SELECT COUNT(*) FROM sessions WHERE status='active'").fetchone()[0]
        revenue = conn.execute("SELECT COALESCE(SUM(fee), 0) FROM sessions WHERE status='completed'").fetchone()[0]
        recent = conn.execute("""SELECT ss.id, ss.vehicle_number, s.code AS slot_code, ss.started_at, ss.ended_at, ss.duration_minutes, ss.fee, ss.status
            FROM sessions ss JOIN slots s ON s.id=ss.slot_id ORDER BY ss.id DESC LIMIT 10""").fetchall()
    return {"total_slots": total, "occupied_slots": occupied, "available_slots": total - occupied,
            "active_sessions": active, "occupancy_percent": round(occupied * 100 / total) if total else 0,
            "revenue_inr": round(float(revenue), 2), "hourly_rate_inr": HOURLY_RATE,
            "recent_sessions": [dict(row) for row in recent]}


@app.get("/api/qr")
def parking_qr():
    image = qrcode.make(FRONTEND_URL)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="image/png", headers={"Cache-Control": "no-store"})
