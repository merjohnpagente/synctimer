import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Maximize, Minimize, Square } from 'lucide-react'
import { ConnectionBadge, SoundControl, TimerFace } from './common'
import { useHotkeys } from '../hooks/useHotkeys'
import { useTimerTitle } from '../hooks/useTimerTitle'
import {
  STATUS,
  installAudioUnlock,
  playAlarm,
  stopAlarm,
  vibrateOnFinish,
} from '../lib/time'

/**
 * Participant dashboard. Minimalist, view-only:
 * deliberately renders ZERO control buttons. Enforcement happens
 * in Security Rules; this UI simply offers nothing to abuse.
 */
export function ViewerDashboard({ code, room, mode = 'countdown', remainingMs, effectiveStatus, connected }) {
  const [isFullscreen, setIsFullscreen] = useState(false)
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

  // Keep the screen awake while watching (best-effort).
  useEffect(() => {
    let lock = null
    let cancelled = false
    ;(async () => {
      try {
        if ('wakeLock' in navigator) {
          lock = await navigator.wakeLock.request('screen')
        }
      } catch {
        // not available / denied — ignore
      }
      if (cancelled && lock) {
        lock.release().catch(() => {})
        lock = null
      }
    })()
    return () => {
      cancelled = true
      if (lock) lock.release().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      // Fullscreen unavailable (e.g. iOS WebView) — layout is already full-bleed.
    }
  }

  useHotkeys({
    f: toggleFullscreen,
    escape: () => ringing && silence(),
  })

  useTimerTitle({
    displayMs: remainingMs,
    status: effectiveStatus,
    name: room.name,
    mode,
  })

  // Progress comes from the same server-time value as the big digits
  // (device-clock math here would disagree with them on skewed clocks).
  // Stopwatch has no target, so it gets no progress bar.
  const isSW = mode === 'stopwatch'
  const frac =
    !isSW && room.durationMs > 0
      ? Math.min(1, Math.max(0, 1 - remainingMs / room.durationMs))
      : 0

  return (
    <div className={`theme-viewer viewer${isFullscreen ? ' is-fullscreen' : ''}`}>
      <header className="viewer-header">
        <div>
          <div className="eyebrow">Shared timer</div>
          <h1 className="viewer-title">{room.name || 'Untitled timer'}</h1>
          <div className="viewer-code">
            Room <strong>{code}</strong>
          </div>
        </div>
        <div className="viewer-badges">
          <ConnectionBadge connected={connected} role="viewer" />
          <SoundControl />
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
            title={`${isFullscreen ? 'Exit full screen' : 'Full screen'} (F)`}
          >
            {isFullscreen ? (
              <Minimize size={16} aria-hidden="true" />
            ) : (
              <Maximize size={16} aria-hidden="true" />
            )}
            <span className="hide-narrow">
              {isFullscreen ? 'Exit full screen' : 'Full screen'}
            </span>
          </button>
        </div>
      </header>

      <main className="viewer-main">
        <TimerFace
          remainingMs={remainingMs}
          status={effectiveStatus}
          durationMs={room.durationMs}
          tone="light"
          mode={mode}
        />
        {!isSW && (
          <div
            className="viewer-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(frac * 100)}
            aria-label="Elapsed time"
          >
            <div
              className="viewer-progress-fill"
              style={{ width: `${Math.round(frac * 100)}%` }}
            />
          </div>
        )}
        <p className="muted viewer-hint">
          {effectiveStatus === STATUS.READY &&
            (mode === 'stopwatch'
              ? 'Waiting for the host to start the stopwatch.'
              : 'Waiting for the host to start the timer.')}
          {effectiveStatus === STATUS.RUNNING &&
            (mode === 'stopwatch'
              ? 'Stopwatch running — synced live.'
              : 'Synced live with the host.')}
          {effectiveStatus === STATUS.PAUSED && 'Paused by the host.'}
          {effectiveStatus === STATUS.FINISHED && "Time's up!"}
          {effectiveStatus === STATUS.ENDED && 'This session has ended.'}
        </p>
        {(effectiveStatus === STATUS.FINISHED ||
          effectiveStatus === STATUS.ENDED) && (
          <Link className="btn btn-secondary" to="/">
            <ArrowLeft size={18} aria-hidden="true" /> Back to home
          </Link>
        )}
        {ringing && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={silence}
          >
            <Square size={16} aria-hidden="true" /> Stop alarm
          </button>
        )}
      </main>
    </div>
  )
}
