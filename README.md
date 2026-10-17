# SmartPark — IBM Z Datathon 2026 prototype

A working full-stack prototype based on the SmartPark presentation. It includes a QR-accessible React website, parking slot availability, session start/end, duration and fee calculation, an admin dashboard, SQLite persistence, a QR image endpoint, and Swagger API documentation.

## Stack

- **Frontend:** React + Vite, CSS, `html5-qrcode`
- **Backend:** Python + FastAPI
- **Database:** SQLite (automatically initialized with 12 demo slots)
- **QR generation:** Python `qrcode`
- **API docs/testing:** Swagger UI at `/docs`; Postman can use the same endpoints
- **Version control:** Git + GitHub

## Requirements

- Python 3.10+
- Node.js 18+
- npm

## Run locally (two terminals)

### 1. Start the API

```bash
cd backend
python -m venv .venv
```

Activate the environment:

- Windows PowerShell: `..\.venv\Scripts\Activate.ps1` (from `backend` use `.venv\Scripts\Activate.ps1`)
- macOS/Linux: `source .venv/bin/activate`

Then install and run:

```bash
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API: http://localhost:8000  
Swagger UI: http://localhost:8000/docs

### 2. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

The frontend expects the API at `http://localhost:8000`. To change it, create `frontend/.env` with:

```env
VITE_API_URL=http://localhost:8000
```

Restart Vite after changing environment variables.

## Demo walkthrough

1. Open **Parking spaces** and choose a green available slot.
2. Enter a demo vehicle registration, such as `TS09AB1234`, and start the session.
3. The slot changes to occupied, and the active session appears on the overview and sessions page.
4. Select **End session**. SmartPark calculates the fee, marks the slot available, and displays a receipt.
5. Open **Admin analytics** to see occupancy, completed-session revenue, recent activity, and the configured hourly rate.
6. Use **Quick access with QR** to display/download the generated QR code. It points to `FRONTEND_URL` (defaults to localhost).

## QR scanning from a phone

The QR code defaults to `http://localhost:5173`, which works on the same computer. For a phone on the same Wi-Fi, set `FRONTEND_URL` in the backend environment to your computer's LAN address, e.g. `http://192.168.1.25:5173`, and configure `VITE_API_URL` to `http://192.168.1.25:8000`. Allow those ports through your local firewall. Camera access is generally restricted to localhost or HTTPS; use HTTPS for a deployed demo.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/slots` | List slots and status |
| POST | `/api/sessions` | Start a session with `{"slot_code":"P-01","vehicle_number":"TS09AB1234"}` |
| GET | `/api/sessions/active` | List active sessions |
| POST | `/api/sessions/{id}/end` | End session, calculate fee, release slot |
| GET | `/api/admin/stats` | Occupancy, revenue and recent sessions |
| GET | `/api/qr` | Generate a PNG QR code for the frontend URL |
| GET | `/docs` | Swagger API documentation |

## Fee rule and demo limitations

The prototype charges **₹30 per started hour by default**, with a minimum one-hour fee. This is configurable with `PARKING_HOURLY_RATE`. This is a demo rule and should be confirmed with your team/judges. The prototype uses manual slot selection rather than physical sensors, and does not include payments, user authentication, reservations, or barrier integration. Those are future-scope items in the presentation. The admin dashboard is a demonstration interface, not an authenticated production admin area.

## Push to GitHub using VS Code

1. Extract/open the `smartpark-prototype` folder in VS Code.
2. Start backend and frontend using the steps above and verify the demo.
3. Open VS Code's Source Control panel, initialize a Git repository, and commit the files. Or use the terminal:

```bash
git init
git add .
git commit -m "Build SmartPark parking management prototype"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Create an empty GitHub repository first and replace the remote URL with your repository URL. Do not commit `.env`, database files, virtual environments, or `node_modules`.

## Suggested demo checklist

- [ ] API starts and `/docs` loads
- [ ] Frontend loads and displays 12 slots
- [ ] Start a session and confirm the slot becomes occupied
- [ ] End a session and confirm the fee receipt appears
- [ ] Confirm slot availability and admin stats update
- [ ] Test QR on the intended demo device
- [ ] Add screenshots and a short demo video to the GitHub README before submission
