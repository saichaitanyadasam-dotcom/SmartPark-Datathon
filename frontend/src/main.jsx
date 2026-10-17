import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { Activity, ArrowDownRight, ArrowUpRight, CarFront, CheckCircle2, CircleHelp, Clock3, Download, LayoutDashboard, MapPin, QrCode, RefreshCw, Search, ShieldCheck, SquareParking, Timer, Wallet, X } from 'lucide-react'
import './styles.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0)
const dateTime = value => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } })
  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null
  if (!response.ok) throw new Error(data?.detail || 'Something went wrong. Please try again.')
  return data
}

function App() {
  const [page, setPage] = useState('overview')
  const [slots, setSlots] = useState([])
  const [stats, setStats] = useState(null)
  const [sessions, setSessions] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [vehicle, setVehicle] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [activeTab, setActiveTab] = useState('driver')
  const [showQR, setShowQR] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [receipt, setReceipt] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const [slotData, statData, sessionData] = await Promise.all([request('/api/slots'), request('/api/admin/stats'), request('/api/sessions/active')])
      setSlots(slotData); setStats(statData); setSessions(sessionData)
    } catch (error) { setNotice({ type: 'error', text: `${error.message} Is the FastAPI server running?` }) }
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    if (!showScanner) return
    let scanner
    const timer = setTimeout(() => {
      scanner = new Html5QrcodeScanner('smartpark-qr-reader', { fps: 10, qrbox: { width: 220, height: 220 }, rememberLastUsedCamera: true }, false)
      scanner.render(decoded => { setShowScanner(false); try { const url = new URL(decoded); if (url.origin === window.location.origin) setPage('overview'); else setNotice({ type: 'success', text: 'QR code scanned. Open the SmartPark website URL to continue.' }) } catch { setNotice({ type: 'success', text: 'QR code scanned successfully.' }) }; scanner.clear().catch(() => {}) }, () => {})
    }, 100)
    return () => { clearTimeout(timer); scanner?.clear().catch(() => {}) }
  }, [showScanner])

  const filteredSlots = useMemo(() => slots.filter(slot => (filter === 'all' || slot.status === filter) && slot.code.toLowerCase().includes(search.toLowerCase())), [slots, filter, search])
  const startParking = async () => {
    if (!selectedSlot) return
    if (!vehicle.trim()) { setNotice({ type: 'error', text: 'Enter your vehicle number to continue.' }); return }
    setBusy(true)
    try { await request('/api/sessions', { method: 'POST', body: JSON.stringify({ slot_code: selectedSlot.code, vehicle_number: vehicle }) }); setNotice({ type: 'success', text: `Parking started at ${selectedSlot.code}. Have a great day!` }); setSelectedSlot(null); setVehicle(''); await refresh() }
    catch (error) { setNotice({ type: 'error', text: error.message }); await refresh() }
    finally { setBusy(false) }
  }
  const endParking = async id => {
    setBusy(true)
    try { const result = await request(`/api/sessions/${id}/end`, { method: 'POST' }); setReceipt(result); setNotice({ type: 'success', text: `Session ended. Total fee: ${money(result.fee)}.` }); await refresh() }
    catch (error) { setNotice({ type: 'error', text: error.message }) }
    finally { setBusy(false) }
  }
  const downloadQR = () => { const link = document.createElement('a'); link.href = `${API}/api/qr`; link.download = 'smartpark-qr.png'; link.click() }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><SquareParking size={25}/></div><div><strong>SmartPark</strong><span>PARK SMARTER. WAIT LESS.</span></div></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="nav-list">
        <button className={page === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('overview')}><LayoutDashboard size={18}/> Overview</button>
        <button className={page === 'parking' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('parking')}><MapPin size={18}/> Parking spaces <span className="nav-count">{stats?.available_slots ?? '—'}</span></button>
        <button className={page === 'sessions' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('sessions')}><Clock3 size={18}/> Active sessions</button>
        <button className={page === 'admin' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('admin')}><Activity size={18}/> Admin analytics</button>
      </nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={18}/></div><strong>Need a hand?</strong><p>Choose a free slot and start your parking session in seconds.</p><button onClick={() => setShowQR(true)}>How it works <ArrowUpRight size={14}/></button></div><div className="version"><span className="online-dot"/> Demo environment <span>v1.0.0</span></div></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs"><span>SmartPark</span><span className="crumb-slash">/</span><strong>{({ overview: 'Overview', parking: 'Parking spaces', sessions: 'Active sessions', admin: 'Admin analytics' })[page]}</strong></div><div className="top-actions"><span className="live-pill"><span/> System live</span><button className="icon-button" title="Refresh data" onClick={refresh}><RefreshCw size={17}/></button><div className="avatar">SP</div></div></header>
      <div className="page-content">
        {notice && <div className={`notice ${notice.type}`} role="status"><span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={16}/></button></div>}
        {page === 'overview' && <>
          <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> SMART PARKING MANAGEMENT</div><h1>Good day. <span>Let's find your space.</span></h1><p className="subheading">A smoother parking experience starts here. Check live availability and get on your way.</p></div><button className="primary-button" onClick={() => { setPage('parking'); setActiveTab('driver') }}><MapPin size={17}/> Find a parking spot</button></section>
          <section className="stats-grid">
            <StatCard icon={<SquareParking size={19}/>} label="Total parking spaces" value={stats?.total_slots ?? '—'} note="Across this facility" tone="blue"/>
            <StatCard icon={<CheckCircle2 size={19}/>} label="Available spaces" value={stats?.available_slots ?? '—'} note="Ready for parking" tone="green" trend={<ArrowUpRight size={14}/>}/>
            <StatCard icon={<CarFront size={19}/>} label="Currently occupied" value={stats?.occupied_slots ?? '—'} note={`${stats?.occupancy_percent ?? 0}% occupancy rate`} tone="orange"/>
            <StatCard icon={<Wallet size={19}/>} label="Revenue collected" value={money(stats?.revenue_inr)} note="Completed sessions" tone="purple"/>
          </section>
          <section className="content-grid"><div className="panel parking-panel"><div className="panel-heading"><div><h2>Parking overview</h2><p>Live status of every parking space</p></div><button className="text-button" onClick={() => setPage('parking')}>View all <ArrowUpRight size={15}/></button></div><div className="legend"><span><i className="legend-dot available"/> Available <b>{stats?.available_slots ?? 0}</b></span><span><i className="legend-dot occupied"/> Occupied <b>{stats?.occupied_slots ?? 0}</b></span></div><div className="slot-grid">{slots.slice(0, 12).map(slot => <button key={slot.id} className={`slot-tile ${slot.status}`} onClick={() => slot.status === 'available' ? setSelectedSlot(slot) : setPage('sessions')} title={`${slot.code}: ${slot.status}`}><CarFront size={19}/><strong>{slot.code}</strong><span>{slot.status === 'available' ? 'Available' : 'Occupied'}</span></button>)}</div><div className="parking-foot"><span><span className="online-dot"/> Updates from the SmartPark database</span><button className="text-button" onClick={refresh}>Refresh <RefreshCw size={13}/></button></div></div>
          <div className="right-stack"><div className="panel occupancy-panel"><div className="panel-heading"><div><h2>Facility occupancy</h2><p>Current space utilization</p></div><span className="small-icon"><Activity size={17}/></span></div><div className="occupancy-number">{stats?.occupancy_percent ?? 0}<span>%</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${stats?.occupancy_percent ?? 0}%` }}/></div><div className="occupancy-foot"><span>{stats?.occupied_slots ?? 0} spaces in use</span><span>{stats?.available_slots ?? 0} free</span></div><div className="occupancy-tip"><ShieldCheck size={17}/><span>Real-time slot status helps reduce time spent searching for parking.</span></div></div>
          <div className="panel qr-panel"><div className="qr-decoration"><QrCode size={27}/></div><div className="qr-copy"><h3>Quick access with QR</h3><p>Scan to open the SmartPark parking portal.</p><button className="text-button" onClick={() => setShowQR(true)}>View QR code <ArrowUpRight size={14}/></button></div></div></div></section>
          <section className="panel activity-panel"><div className="panel-heading"><div><h2>Active parking sessions</h2><p>Vehicles currently parked at the facility</p></div><button className="text-button" onClick={() => setPage('sessions')}>Manage sessions <ArrowUpRight size={15}/></button></div><SessionTable sessions={sessions.slice(0, 4)} onEnd={endParking} busy={busy}/></section>
        </>}
        {page === 'parking' && <><section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> PARKING MAP</div><h1>Find your <span>perfect spot.</span></h1><p className="subheading">Choose any available parking space to begin. Your slot status updates automatically.</p></div><button className="secondary-button" onClick={() => setShowScanner(true)}><QrCode size={17}/> Scan entrance QR</button></section><div className="panel full-panel"><div className="panel-heading"><div><h2>All parking spaces</h2><p>{stats?.available_slots ?? 0} spaces currently available</p></div><div className="toolbar"><div className="search-box"><Search size={15}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search slot ID"/></div><select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter slots"><option value="all">All spaces</option><option value="available">Available</option><option value="occupied">Occupied</option></select></div></div><div className="legend"><span><i className="legend-dot available"/> Available <b>{stats?.available_slots ?? 0}</b></span><span><i className="legend-dot occupied"/> Occupied <b>{stats?.occupied_slots ?? 0}</b></span></div><div className="slot-grid expanded">{filteredSlots.map(slot => <button key={slot.id} className={`slot-tile ${slot.status}`} onClick={() => slot.status === 'available' ? setSelectedSlot(slot) : setNotice({ type: 'error', text: `${slot.code} is occupied. Select an available space instead.` })}><CarFront size={22}/><strong>{slot.code}</strong><span>{slot.status === 'available' ? 'Available · Select' : 'Occupied'}</span></button>)}</div>{filteredSlots.length === 0 && <div className="empty-state">No spaces match your search.</div>}</div></>}
        {page === 'sessions' && <><section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> SESSION MANAGEMENT</div><h1>Parking <span>sessions.</span></h1><p className="subheading">Review active vehicles and finish a session to calculate its parking fee.</p></div><div className="session-count"><span className="online-dot"/>{sessions.length} active</div></section><div className="panel full-panel"><div className="panel-heading"><div><h2>Currently parked</h2><p>Sessions are saved in the SmartPark database</p></div><button className="secondary-button" onClick={refresh}><RefreshCw size={15}/> Refresh</button></div><SessionTable sessions={sessions} onEnd={endParking} busy={busy}/>{sessions.length === 0 && <div className="empty-state"><CarFront size={28}/><strong>No active sessions</strong><span>Available parking spaces are ready to use.</span><button className="primary-button" onClick={() => setPage('parking')}>Find a space</button></div>}</div></>}
        {page === 'admin' && <><section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> ADMINISTRATION</div><h1>Insights at a <span>glance.</span></h1><p className="subheading">Monitor occupancy, parking activity and fee collection.</p></div><button className="secondary-button" onClick={refresh}><RefreshCw size={15}/> Refresh analytics</button></section><section className="stats-grid"><StatCard icon={<SquareParking size={19}/>} label="Total spaces" value={stats?.total_slots ?? '—'} note="Registered spaces" tone="blue"/><StatCard icon={<CarFront size={19}/>} label="Active sessions" value={stats?.active_sessions ?? '—'} note="Vehicles parked now" tone="orange"/><StatCard icon={<Wallet size={19}/>} label="Total revenue" value={money(stats?.revenue_inr)} note="Completed sessions" tone="purple"/><StatCard icon={<Timer size={19}/>} label="Hourly parking rate" value={money(stats?.hourly_rate_inr)} note="Per started hour · INR" tone="green"/></section><div className="content-grid admin-grid"><div className="panel"><div className="panel-heading"><div><h2>Occupancy breakdown</h2><p>Live facility utilization</p></div></div><div className="admin-bar-row"><span>Occupied</span><div className="admin-track"><div className="admin-fill occupied-fill" style={{ width: `${stats?.occupancy_percent ?? 0}%` }}/></div><b>{stats?.occupied_slots ?? 0}</b></div><div className="admin-bar-row"><span>Available</span><div className="admin-track"><div className="admin-fill available-fill" style={{ width: `${stats?.total_slots ? stats.available_slots / stats.total_slots * 100 : 0}%` }}/></div><b>{stats?.available_slots ?? 0}</b></div><div className="admin-summary"><span>Occupancy rate</span><strong>{stats?.occupancy_percent ?? 0}%</strong></div></div><div className="panel"><div className="panel-heading"><div><h2>Parking configuration</h2><p>Prototype settings</p></div><span className="small-icon"><ShieldCheck size={17}/></span></div><div className="config-row"><span>Fee calculation</span><strong>Per started hour</strong></div><div className="config-row"><span>Currency</span><strong>Indian Rupee (INR)</strong></div><div className="config-row"><span>Data storage</span><strong>SQLite database</strong></div><div className="config-row"><span>API documentation</span><a href={`${API}/docs`} target="_blank" rel="noreferrer">Open Swagger ↗</a></div></div></div><div className="panel full-panel"><div className="panel-heading"><div><h2>Recent parking activity</h2><p>Latest sessions recorded by the system</p></div></div><HistoryTable rows={stats?.recent_sessions ?? []}/></div></>}
      </div>
      <footer className="footer"><span>© 2026 SmartPark · IBM Z Datathon prototype</span><span><span className="online-dot"/> Connected to SmartPark API</span></footer>
    </main>

    {selectedSlot && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSelectedSlot(null) }}><div className="modal"><button className="modal-close" onClick={() => setSelectedSlot(null)}><X size={18}/></button><div className="modal-symbol"><CarFront size={25}/></div><div className="eyebrow">RESERVE YOUR SPACE</div><h2>Park at {selectedSlot.code}</h2><p className="modal-desc">This space is available. Enter your vehicle number to start your parking session.</p><label className="field-label" htmlFor="vehicle">Vehicle registration number</label><input id="vehicle" className="field-input" value={vehicle} onChange={e => setVehicle(e.target.value.toUpperCase())} placeholder="e.g. TS09AB1234" maxLength={20} autoFocus/><div className="rate-note"><Wallet size={16}/><span>Parking rate</span><strong>{money(stats?.hourly_rate_inr ?? 30)} / hour</strong></div><button className="primary-button wide" disabled={busy} onClick={startParking}>{busy ? 'Starting session…' : 'Start parking session'} <ArrowUpRight size={16}/></button><p className="fine-print">The fee is calculated when you end your session.</p></div></div>}
    {showQR && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowQR(false) }}><div className="modal qr-modal"><button className="modal-close" onClick={() => setShowQR(false)}><X size={18}/></button><div className="modal-symbol"><QrCode size={25}/></div><div className="eyebrow">SMARTPARK QUICK ACCESS</div><h2>One scan. You're in.</h2><p className="modal-desc">Scan this QR code with your phone to open the SmartPark web portal. Your phone must be able to reach the computer running this prototype.</p><img className="qr-image" src={`${API}/api/qr`} alt="SmartPark website QR code"/><button className="secondary-button wide" onClick={downloadQR}><Download size={16}/> Download QR code</button><p className="fine-print">For phone demos, configure FRONTEND_URL with your computer's LAN IP.</p></div></div>}
    {showScanner && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowScanner(false) }}><div className="modal scanner-modal"><button className="modal-close" onClick={() => setShowScanner(false)}><X size={18}/></button><div className="modal-symbol"><QrCode size={25}/></div><h2>Scan a QR code</h2><p className="modal-desc">Allow camera access when prompted. Camera access requires localhost or HTTPS.</p><div id="smartpark-qr-reader" className="scanner-box"/><button className="secondary-button wide" onClick={() => setShowScanner(false)}>Cancel</button></div></div>}
    {receipt && (<div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setReceipt(null) }}><div className="modal receipt-modal"><button className="modal-close" onClick={() => setReceipt(null)}><X size={18}/></button><div className="receipt-check"><CheckCircle2 size={30}/></div><div className="eyebrow">PARKING RECEIPT</div><h2>You're all set.</h2><p className="modal-desc">Your parking session has ended successfully.</p><div className="receipt-total"><span>Total parking fee</span><strong>{money(receipt.fee)}</strong></div><div className="receipt-line"><span>Vehicle</span><strong>{receipt.vehicle_number}</strong></div><div className="receipt-line"><span>Parking space</span><strong>{receipt.slot_code}</strong></div><div className="receipt-line"><span>Duration</span><strong>{receipt.duration_minutes} min</strong></div><div className="receipt-line"><span>Started</span><strong>{dateTime(receipt.started_at)}</strong></div><div className="receipt-line"><span>Ended</span><strong>{dateTime(receipt.ended_at)}</strong></div><button className="primary-button wide" onClick={() => setReceipt(null)}>Done</button></div></div>)}
     </div>
}

function StatCard({ icon, label, value, note, tone, trend }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <span className="stat-label">{label}</span>
      <div className="stat-value">{value}</div>
      <div className="stat-note">
        {trend && <span className="trend-icon">{trend}</span>}
        {note}
      </div>
    </div>
  );
}
function SessionTable({ sessions, onEnd, busy }) { return <div className="table-wrap"><table><thead><tr><th>VEHICLE</th><th>PARKING SPACE</th><th>ENTRY TIME</th><th>STATUS</th><th/></tr></thead><tbody>{sessions.map(s => <tr key={s.id}><td><div className="vehicle-cell"><span className="vehicle-icon"><CarFront size={17}/></span><strong>{s.vehicle_number}</strong></div></td><td><span className="slot-code">{s.slot_code}</span></td><td>{dateTime(s.started_at)}</td><td><span className="status-pill active-status"><i/> Active</span></td><td className="end-cell"><button className="end-button" disabled={busy} onClick={() => onEnd(s.id)}>End session <ArrowDownRight size={14}/></button></td></tr>)}</tbody></table>{sessions.length === 0 && <div className="table-empty">No active parking sessions at the moment.</div>}</div> }
function HistoryTable({ rows }) { return <div className="table-wrap"><table><thead><tr><th>VEHICLE</th><th>SPACE</th><th>STARTED</th><th>DURATION</th><th>FEE</th><th>STATUS</th></tr></thead><tbody>{rows.map(s => <tr key={s.id}><td><strong>{s.vehicle_number}</strong></td><td><span className="slot-code">{s.slot_code}</span></td><td>{dateTime(s.started_at)}</td><td>{s.duration_minutes == null ? '—' : `${s.duration_minutes} min`}</td><td>{s.fee == null ? '—' : money(s.fee)}</td><td><span className={`status-pill ${s.status === 'active' ? 'active-status' : 'completed-status'}`}><i/>{s.status}</span></td></tr>)}</tbody></table>{rows.length === 0 && <div className="table-empty">No parking activity recorded yet.</div>}</div> }

createRoot(document.getElementById('root')).render(<App />)
