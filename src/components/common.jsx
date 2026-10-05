import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Timer, Volume2, VolumeX } from 'lucide-react'
import {
  STATUS_LABEL,
  ensureAudioUnlocked,
  formatClock,
  isSoundEnabled,
  playAlarm,
  setSoundEnabled,
} from '../lib/time'

export function ConnectionBadge({ connected, role }) {
  return (
    <div className="conn-badge" role="status" aria-live="polite">
      <span
        className={`conn-dot ${connected ? 'is-live' : 'is-off'}`}
        aria-hidden="true"
      />
      <span className="conn-text">{connected ? 'Live' : 'Reconnecting…'}</span>
      {role && <span className={`role-chip role-${role}`}>{role}</span>}
    </div>
  )
}

export function StatusPill({ status }) {
  return (
    <span className={`status-pill status-${status}`} aria-live="polite">
      {STATUS_LABEL[status] || status}
    </span>
  )
}

/** Big synchronized digits + progress ring. Read-only visual. */
export function TimerFace({
  remainingMs,
  status,
  durationMs,
  tone = 'dark',
  mode = 'countdown',
}) {
  const isSW = mode === 'stopwatch'
  // Stopwatch counts UP from zero (floor so 00:00 shows at the start);
  // countdown rounds UP so 0:01 shows until the very last moment.
  const totalSec = Math.max(
    0,
    isSW ? Math.floor(remainingMs / 1000) : Math.ceil(remainingMs / 1000),
  )
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n) => String(n).padStart(2, '0')
  const main = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
  const tenths = Math.max(0, Math.floor((remainingMs % 1000) / 100))

  const frac = isSW
    ? 1
    : durationMs > 0
      ? Math.min(1, Math.max(0, 1 - remainingMs / durationMs))
      : 0
  const R = 120
  const C = 2 * Math.PI * R

  const urgent = !isSW && status === 'running' && remainingMs <= 10_000
  const done = status === 'finished' || status === 'ended'
  const elapsed = durationMs > 0 ? Math.max(0, durationMs - remainingMs) : 0
  // The big digits already ARE the elapsed time in stopwatch mode.
  const showElapsed =
    !isSW &&
    durationMs > 0 &&
    (status === 'running' || status === 'paused' || status === 'finished')

  return (
    <div className={`timer-face tone-${tone}`}>
      <div
        className={`timer-ring-wrap ${urgent ? 'is-urgent' : ''} ${done ? 'is-done' : ''}`}
      >
        <svg className="timer-ring" viewBox="0 0 280 280" aria-hidden="true">
          <circle cx="140" cy="140" r={R} className="ring-track" />
          <circle
            cx="140"
            cy="140"
            r={R}
            className="ring-fill"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - frac)}
            transform="rotate(-90 140 140)"
          />
        </svg>
        <div className="timer-digits">
          <div
            className="timer-main"
            aria-label={`${main} ${isSW ? 'elapsed' : 'remaining'}, timer ${status}`}
          >
            {main}
            <span className="timer-tenths">.{tenths}</span>
          </div>
          <StatusPill status={status} />
          {showElapsed && (
            <div
              className="timer-elapsed"
              aria-label={`Elapsed ${formatClock(elapsed)}`}
            >
              <Timer size={14} aria-hidden="true" /> Elapsed{' '}
              {formatClock(elapsed)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ParticipantsList({ participants }) {
  if (!participants || participants.length === 0) {
    return <p className="muted">No participants yet — share the invite link.</p>
  }
  return (
    <ul className="plist">
      {participants.map((p) => (
        <li key={p.id} className="plist-item">
          <span
            className={`pdot ${p.role === 'host' ? 'pdot-host' : 'pdot-viewer'}`}
            aria-hidden="true"
          />
          <span className="pname">{p.name || 'Guest'}</span>
          <span className="prole">{p.role === 'host' ? 'Host' : 'Viewer'}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Sound on/off toggle + Test button.
 * Tapping Test both previews the finish alarm AND unlocks browser audio,
 * so the real alarm can be heard when the timer ends.
 */
export function SoundControl() {
  const [enabled, setEnabled] = useState(() => isSoundEnabled())
  const [testing, setTesting] = useState(false)

  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    setSoundEnabled(next)
    if (next) {
      ensureAudioUnlocked()
      playAlarm(2)
    }
  }

  const test = () => {
    ensureAudioUnlocked()
    setTesting(true)
    playAlarm(2)
    setTimeout(() => setTesting(false), 1200)
  }

  return (
    <div className="sound-ctl">
      <button
        type="button"
        className="btn btn-ghost btn-small"
        onClick={toggle}
        aria-pressed={enabled}
        title={enabled ? 'Mute the finish alarm' : 'Unmute the finish alarm'}
      >
        {enabled ? (
          <>
            <Volume2 size={16} aria-hidden="true" /> Sound on
          </>
        ) : (
          <>
            <VolumeX size={16} aria-hidden="true" /> Muted
          </>
        )}
      </button>
      {enabled && (
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={test}
          disabled={testing}
          title="Preview the finish alarm"
        >
          {testing ? 'Playing…' : 'Test'}
        </button>
      )}
    </div>
  )
}

/**
 * Tells the user WHY a room won't open: genuinely missing vs access
 * refused (sign-in/connection problem on this device) — with actions.
 */
export function RoomErrorPanel({ code, access }) {
  const denied = access === 'denied'
  return (
    <>
      <h1>{denied ? 'Can’t open this room' : 'Room not found'}</h1>
      <p className="muted">
        {denied ? (
          <>
            The app couldn’t sign you in, so the database refused access to
            room <strong className="chip-code">{code}</strong>.
          </>
        ) : (
          <>
            There is no shared timer with code{' '}
            <strong className="chip-code">{code}</strong>
          </>
        )}
      </p>
      <div className="card notfound-card">
        <h2 className="card-title">What to try</h2>
        <ul className="dl-list">
          {denied ? (
            <>
              <li>Check your internet connection, then try again.</li>
              <li>
                Turn off any ad-blocker, VPN, or data-saver for this site.
              </li>
              <li>
                If you opened this inside Messenger/Facebook, open it in
                Chrome instead.
              </li>
            </>
          ) : (
            <>
              <li>The code may have a typo — check it with the host.</li>
              <li>
                The room may have been created in demo/offline mode, so it
                was never saved online.
              </li>
              <li>The host may have deleted it, or you may be offline.</li>
            </>
          )}
        </ul>
      </div>
      <div className="update-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
        <Link className="btn btn-secondary" to="/">
          Back home
        </Link>
      </div>
    </>
  )
}
