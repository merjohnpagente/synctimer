/**
 * Countdown-only time utilities.
 * Sync model: the host writes { status, endsAt, remainingMs }.
 * Every client renders remaining = endsAt - Date.now() while running,
 * so all devices converge without syncing every tick.
 */

export const STATUS = {
  READY: 'ready',
  RUNNING: 'running',
  PAUSED: 'paused',
  FINISHED: 'finished',
  ENDED: 'ended',
}

export const STATUS_LABEL = {
  ready: 'Ready',
  running: 'Running',
  paused: 'Paused',
  finished: 'Finished',
  ended: 'Ended',
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateRoomCode(length = 6) {
  let code = ''
  const buf = new Uint32Array(length)
  crypto.getRandomValues(buf)
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length]
  }
  return code
}

export function normalizeCode(input) {
  return String(input || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12)
}

export function clampDurationMs(ms) {
  const MIN = 5_000
  const MAX = 24 * 60 * 60 * 1_000
  if (!Number.isFinite(ms)) return 5 * 60 * 1_000
  return Math.min(MAX, Math.max(MIN, Math.round(ms)))
}

/** Remaining ms for a room snapshot at a given moment. */
export function computeRemainingMs(room, now = Date.now()) {
  if (!room) return 0
  const status = room.status || STATUS.READY
  if (status === STATUS.RUNNING && typeof room.endsAt === 'number') {
    return Math.max(0, room.endsAt - now)
  }
  if (typeof room.remainingMs === 'number') {
    return Math.max(0, room.remainingMs)
  }
  return Math.max(0, room.durationMs || 0)
}

export function formatClock(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n) => String(n).padStart(2, '0')
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}

export function formatTenths(ms) {
  const tenths = Math.max(0, Math.floor((ms % 1000) / 100))
  return `.${tenths}`
}

export function progressFraction(room, now = Date.now()) {
  if (!room || !room.durationMs) return 0
  const remaining = computeRemainingMs(room, now)
  return Math.min(1, Math.max(0, 1 - remaining / room.durationMs))
}

let audioCtx = null

/** Short chime on finish. Uses WebAudio so no asset files are needed. */
export function playFinishChime(times = 3) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    audioCtx = audioCtx || new Ctx()
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    const now = audioCtx.currentTime
    for (let i = 0; i < times; i++) {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.value = i % 2 === 0 ? 880 : 660
      const t = now + i * 0.28
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
      osc.connect(gain).connect(audioCtx.destination)
      osc.start(t)
      osc.stop(t + 0.3)
    }
  } catch {
    // Audio is best-effort (autoplay policies, headless envs).
  }
}

export function vibrateOnFinish() {
  try {
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 500])
  } catch {
    // ignore
  }
}

export function inviteLinkFor(code) {
  const clean = normalizeCode(code)
  return `${window.location.origin}/watch/${clean}`
}
