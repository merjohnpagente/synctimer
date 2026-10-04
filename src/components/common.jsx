import { STATUS_LABEL } from '../lib/time'

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
export function TimerFace({ remainingMs, status, durationMs, tone = 'dark' }) {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n) => String(n).padStart(2, '0')
  const main = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
  const tenths = Math.max(0, Math.floor((remainingMs % 1000) / 100))

  const frac =
    durationMs > 0
      ? Math.min(1, Math.max(0, 1 - remainingMs / durationMs))
      : 0
  const R = 120
  const C = 2 * Math.PI * R

  const urgent = status === 'running' && remainingMs <= 10_000
  const done = status === 'finished' || status === 'ended'

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
            aria-label={`${main} remaining, timer ${status}`}
          >
            {main}
            <span className="timer-tenths">.{tenths}</span>
          </div>
          <StatusPill status={status} />
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
