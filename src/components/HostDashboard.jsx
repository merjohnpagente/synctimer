import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Expand, Square, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { ConnectionBadge, ParticipantsList, SoundControl, TimerFace } from './common'
import {
  STATUS,
  installAudioUnlock,
  inviteLinkFor,
  playAlarm,
  stopAlarm,
  vibrateOnFinish,
} from '../lib/time'

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      return true
    } catch {
      return false
    }
  }
}

export function SharePanel({ code }) {
  const link = inviteLinkFor(code)
  const [copied, setCopied] = useState('')
  const [zoomed, setZoomed] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const flash = (what) => {
    setCopied(what)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(''), 1800)
  }

  return (
    <section className="card share-card" aria-label="Share room">
      <h2 className="card-title">Invite viewers</h2>
      <div className="share-code-row">
        <div>
          <div className="field-label">Room code</div>
          <div className="room-code" data-testid="room-code">
            {code}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => copyText(code).then((ok) => ok && flash('code'))}
        >
          {copied === 'code' ? 'Copied!' : 'Copy code'}
        </button>
      </div>
      <div className="share-link-row">
        <input
          className="input share-link"
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          aria-label="Invitation link"
        />
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => copyText(link).then((ok) => ok && flash('link'))}
        >
          {copied === 'link' ? 'Copied!' : 'Copy link'}
        </button>
      </div>
      <div className="qr-wrap">
        <button
          type="button"
          className="qr-zoom-btn"
          onClick={() => setZoomed(true)}
          aria-label="Show QR code full screen"
        >
          <QRCodeSVG value={link} size={180} aria-hidden="true" />
          <span className="qr-zoom-hint">
            <Expand size={14} aria-hidden="true" /> Tap to enlarge
          </span>
        </button>
        <p className="muted small">
          Viewers scan to join read-only. They can never control the timer —
          enforced by database rules.
        </p>
      </div>
      {zoomed && (
        <div
          className="qr-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Room QR code enlarged"
          onClick={() => setZoomed(false)}
        >
          <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="room-code">{code}</div>
            <QRCodeSVG
              value={link}
              size={320}
              className="qr-modal-img"
              aria-label="QR code for invite link"
            />
            <p className="muted small">Scan to join as viewer</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setZoomed(false)}
            >
              <X size={16} aria-hidden="true" /> Close
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * Admin dashboard (host only). Dark theme.
 * All buttons call host-gated actions; Security Rules reject
 * non-owner writes even if someone crafts requests manually.
 */
export function HostDashboard({
  code,
  room,
  mode = 'countdown',
  remainingMs,
  effectiveStatus,
  participants,
  connected,
  actions,
  demo = false,
}) {
  const [busy, setBusy] = useState('')
  const [actionError, setActionError] = useState(null)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [ringing, setRinging] = useState(false)
  const prevStatus = useRef(null)
  const ringTimer = useRef(null)

  // First tap anywhere unlocks browser audio so the alarm can be heard.
  useEffect(() => {
    installAudioUnlock()
    return () => {
      clearTimeout(ringTimer.current)
      stopAlarm()
    }
  }, [])

  const silence = () => {
    stopAlarm()
    clearTimeout(ringTimer.current)
    setRinging(false)
  }

  // Looping alarm once per finish (also if opened while already finished).
  useEffect(() => {
    if (
      prevStatus.current !== STATUS.FINISHED &&
      effectiveStatus === STATUS.FINISHED
    ) {
      playAlarm(10)
      vibrateOnFinish()
      setRinging(true)
      clearTimeout(ringTimer.current)
      ringTimer.current = setTimeout(() => setRinging(false), 10500)
    }
    prevStatus.current = effectiveStatus
  }, [effectiveStatus])

  const run = async (label, fn) => {
    setBusy(label)
    setActionError(null)
    try {
      await fn()
    } catch (err) {
      setActionError(err?.message || 'Action failed.')
    } finally {
      setBusy('')
    }
  }

  const viewerCount = participants.filter((p) => p.role !== 'host').length

  return (
    <div className="theme-host dashboard">
      <header className="dash-header">
        <div>
          <div className="eyebrow">Admin dashboard</div>
          <h1 className="dash-title">{room.name || 'Untitled timer'}</h1>
          <div className="dash-sub">
            <span className="chip chip-code">{code}</span>
            <span className="muted small">
              {viewerCount} viewer{viewerCount === 1 ? '' : 's'} connected
            </span>
          </div>
        </div>
        <div className="dash-head-right">
          <ConnectionBadge connected={connected} role="host" />
          <SoundControl />
        </div>
      </header>

      {demo && (
        <p className="notice dash-notice" role="note">
          Demo mode: this room exists only in THIS browser. Anyone opening the
          invite link on another device will see “Room not found”. Add your
          Firebase keys to enable real multi-device sync.
        </p>
      )}

      <main className="dash-grid">
        <section className="timer-section">
          <TimerFace
            remainingMs={remainingMs}
            status={effectiveStatus}
            durationMs={room.durationMs}
            tone="dark"
            mode={mode}
          />
          {actionError && (
            <p className="error" role="alert">
              {actionError}
            </p>
          )}
          <div className="controls" role="group" aria-label="Timer controls">
            {(effectiveStatus === STATUS.READY ||
              effectiveStatus === STATUS.FINISHED) && (
              <button
                type="button"
                className="btn btn-primary btn-big"
                disabled={!!busy}
                onClick={() => run('start', actions.start)}
              >
                {busy === 'start' ? 'Starting…' : 'Start'}
              </button>
            )}
            {effectiveStatus === STATUS.RUNNING && (
              <button
                type="button"
                className="btn btn-primary btn-big"
                disabled={!!busy}
                onClick={() => run('pause', actions.pause)}
              >
                {busy === 'pause' ? 'Pausing…' : 'Pause'}
              </button>
            )}
            {effectiveStatus === STATUS.PAUSED && (
              <button
                type="button"
                className="btn btn-primary btn-big"
                disabled={!!busy}
                onClick={() => run('resume', actions.resume)}
              >
                {busy === 'resume' ? 'Resuming…' : 'Resume'}
              </button>
            )}
            {effectiveStatus !== STATUS.ENDED && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!!busy}
                onClick={() => run('reset', actions.reset)}
              >
                Reset
              </button>
            )}
            {(effectiveStatus === STATUS.READY ||
              effectiveStatus === STATUS.PAUSED ||
              effectiveStatus === STATUS.FINISHED) &&
              mode !== 'stopwatch' && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!!busy}
                  onClick={() => run('+60', () => actions.adjust(60_000))}
                  aria-label="Add one minute"
                >
                  +1:00
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!!busy}
                  onClick={() => run('-60', () => actions.adjust(-60_000))}
                  aria-label="Subtract one minute"
                >
                  −1:00
                </button>
              </>
            )}
          </div>
          {ringing && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={silence}
            >
              <Square size={16} aria-hidden="true" /> Stop alarm
            </button>
          )}
          {effectiveStatus !== STATUS.ENDED &&
            (confirmEnd ? (
              <div className="end-confirm">
                <span>End this session for everyone?</span>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={!!busy}
                  onClick={() => run('end', actions.endSession)}
                >
                  Yes, end it
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setConfirmEnd(false)}
                >
                  Keep going
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-danger-ghost"
                onClick={() => setConfirmEnd(true)}
              >
                End session
              </button>
            ))}
          {effectiveStatus === STATUS.ENDED && (
            <Link className="btn btn-secondary" to="/">
              <ArrowLeft size={18} aria-hidden="true" /> Back to home
            </Link>
          )}
        </section>

        <aside className="side-section">
          <SharePanel code={code} />
          <section className="card" aria-label="Participants">
            <h2 className="card-title">
              Participants{' '}
              <span className="count-badge">{participants.length}</span>
            </h2>
            <ParticipantsList participants={participants} />
          </section>
        </aside>
      </main>
    </div>
  )
}
