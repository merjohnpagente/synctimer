import { useState } from 'react'
import { Timer, Volume2, VolumeX } from 'lucide-react'
import {
  STATUS_LABEL,
  ensureAudioUnlocked,
  formatClock,
  isSoundEnabled,
  playFinishChime,
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
      playFinishChime(2)
    }
  }

  const test = () => {
    ensureAudioUnlocked()
    setTesting(true)
    playFinishChime(2)
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
