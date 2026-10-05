import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera, Smartphone } from 'lucide-react'
import { UpdateBanner } from '../components/UpdateBanner'
import { isFirebaseConfigured } from '../lib/firebase'
import { APP_VERSION, isNativeApp } from '../lib/site'
import { createRoom } from '../hooks/useRoom'
import { clampDurationMs, normalizeCode } from '../lib/time'
import { extractCodeFromScan } from '../lib/scan'

// Camera library is heavy — only load it when someone taps "Scan QR".
const QrScanner = lazy(() =>
  import('../components/QrScanner').then((m) => ({ default: m.QrScanner })),
)

const PRESETS = [
  { label: '1 min', ms: 60_000 },
  { label: '5 min', ms: 5 * 60_000 },
  { label: '10 min', ms: 10 * 60_000 },
  { label: '15 min', ms: 15 * 60_000 },
  { label: '25 min', ms: 25 * 60_000 },
  { label: '60 min', ms: 60 * 60_000 },
]

function loadName() {
  try {
    return localStorage.getItem('synctimer-name') || ''
  } catch {
    return ''
  }
}

export function HomePage({ uid, authReady, authError }) {
  const navigate = useNavigate()
  const [roomName, setRoomName] = useState('')
  const [minutes, setMinutes] = useState(10)
  const [timerMode, setTimerMode] = useState('countdown')
  const [joinCode, setJoinCode] = useState('')
  const [displayName, setDisplayName] = useState(loadName)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState(null)

  // Support share links like ?join=ABC123 (query links survive apps such
  // as Messenger that sometimes strip #fragments from shared URLs).
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search)
      const j = normalizeCode(
        q.get('join') || q.get('code') || q.get('room') || '',
      )
      if (j) navigate(`/watch/${j}`, { replace: true })
    } catch {
      // ignore malformed URLs
    }
  }, [navigate])

  const persistName = (v) => {
    setDisplayName(v)
    try {
      localStorage.setItem('synctimer-name', v)
    } catch {
      // ignore
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setError(null)
    if (!uid) {
      setError('Signing you in… please try again in a second.')
      return
    }
    if (timerMode === 'countdown' && !(Number(minutes) > 0)) {
      setError('Enter a duration of at least 1 minute.')
      return
    }
    setCreating(true)
    try {
      const durationMs = clampDurationMs(Number(minutes) * 60_000)
      const code = await createRoom({
        name: roomName.trim() || 'Untitled timer',
        durationMs,
        ownerId: uid,
        mode: timerMode,
      })
      navigate(`/admin/${code}`)
    } catch (err) {
      setError(err?.message || 'Could not create room.')
    } finally {
      setCreating(false)
    }
  }

  const handleJoin = (e) => {
    e.preventDefault()
    const clean = normalizeCode(joinCode)
    if (!clean) {
      setError('Enter a room code to join.')
      return
    }
    navigate(`/watch/${clean}`)
  }

  const handleScan = useCallback(
    (text) => {
      const code = extractCodeFromScan(text)
      if (!code) {
        setScanError('That QR code has no room code. Try again.')
        return
      }
      setScanning(false)
      navigate(`/watch/${code}`)
    },
    [navigate],
  )

  return (
    <div className="theme-host home">
      <UpdateBanner />
      <header className="home-hero">
        <img
          src="/logo.svg"
          className="brand-mark"
          alt="SyncTimer logo"
          width={56}
          height={56}
        />
        <div className="eyebrow">
          SyncTimer <span className="ver-chip">{APP_VERSION}</span>
        </div>
        <h1>One timer, every screen.</h1>
        <p className="muted">
          The host controls a countdown from the admin dashboard. Viewers join
          with a code or link and stay in sync in real time.
        </p>
        <div className="home-cta-row">
          {!isNativeApp() && (
            <Link className="btn btn-secondary" to="/download">
              <Smartphone size={18} aria-hidden="true" /> Get the Android app
            </Link>
          )}
        </div>
        {!isFirebaseConfigured && (
          <p className="notice" role="note">
            Demo mode: Firebase env vars are missing, so rooms only work on this
            device. See <code>.env.example</code> + <code>FIREBASE_SETUP.md</code>{' '}
            to enable real multi-device sync.
          </p>
        )}
        {authError && (
          <p className="error" role="alert">
            {authError}
          </p>
        )}
      </header>

      <main className="home-grid">
        <section className="card" aria-label="Admin: create a room">
          <h2 className="card-title">Host a timer</h2>
          <form onSubmit={handleCreate} className="form">
            <label className="field">
              <span className="field-label">Timer name</span>
              <input
                className="input"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="e.g. Morning workout"
                maxLength={80}
              />
            </label>
            <div className="segmented" role="group" aria-label="Timer mode">
              {[
                { value: 'countdown', label: 'Countdown' },
                { value: 'stopwatch', label: 'Stopwatch' },
              ].map((m) => (
                <button
                  key={m.value}
                  type="button"
                  className={`segmented-btn${timerMode === m.value ? ' is-active' : ''}`}
                  aria-pressed={timerMode === m.value}
                  onClick={() => setTimerMode(m.value)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {timerMode === 'countdown' ? (
              <>
                <label className="field">
                  <span className="field-label">Duration (minutes)</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={1440}
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    inputMode="numeric"
                  />
                </label>
                <div className="preset-row" role="group" aria-label="Presets">
                  {PRESETS.map((p) => {
                    const active = Number(minutes) === p.ms / 60_000
                    return (
                      <button
                        key={p.label}
                        type="button"
                        className={`chip-btn${active ? ' is-active' : ''}`}
                        aria-pressed={active}
                        onClick={() => setMinutes(p.ms / 60_000)}
                      >
                        {p.label}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <p className="muted small mode-hint">
                Counts up from 00:00 until you pause or end it.
              </p>
            )}
            <button
              type="submit"
              className="btn btn-primary btn-big"
              disabled={creating || !authReady}
            >
              {creating ? 'Creating…' : 'Create room'}
            </button>
          </form>
        </section>

        <section className="card" aria-label="Viewer: join a room">
          <h2 className="card-title">Join a timer</h2>
          <form onSubmit={handleJoin} className="form">
            <label className="field">
              <span className="field-label">Your name (shown to host)</span>
              <input
                className="input"
                value={displayName}
                onChange={(e) => persistName(e.target.value)}
                placeholder="e.g. Alex"
                maxLength={40}
              />
            </label>
            <label className="field">
              <span className="field-label">Room code</span>
              <input
                className="input code-input"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. KQ7X2P"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            <button type="submit" className="btn btn-secondary btn-big">
              Join as viewer
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-big"
              onClick={() => {
                setScanError(null)
                setScanning(true)
              }}
            >
              <Camera size={18} aria-hidden="true" /> Scan QR instead
            </button>
            {scanning && (
              <Suspense
                fallback={<p className="muted small">Starting camera…</p>}
              >
                <QrScanner
                  onScan={handleScan}
                  onClose={() => setScanning(false)}
                />
              </Suspense>
            )}
            {scanError && (
              <p className="error" role="alert">
                {scanError}
              </p>
            )}
            <p className="muted small">
              Viewers only watch — no controls, enforced by database rules.
            </p>
          </form>
        </section>
      </main>

      {error && (
        <p className="error home-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
