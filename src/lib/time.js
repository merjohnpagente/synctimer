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

export const MODES = {
  COUNTDOWN: 'countdown',
  STOPWATCH: 'stopwatch',
}

export const MODE_LABEL = {
  countdown: 'Countdown',
  stopwatch: 'Stopwatch',
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

/** Elapsed ms for a stopwatch room (count-up from 0). */
export function computeElapsedMs(room, now = Date.now()) {
  if (!room) return 0
  const base = typeof room.elapsedBaseMs === 'number' ? room.elapsedBaseMs : 0
  if (room.status === STATUS.RUNNING && typeof room.startedAt === 'number') {
    return Math.max(0, base + (now - room.startedAt))
  }
  return Math.max(0, base)
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

/** Count-up clock (floor-based so 00:00 shows at the start). */
export function formatUp(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
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

const SOUND_KEY = 'synctimer-sound'

export function isSoundEnabled() {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSoundEnabled(on) {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    // ignore
  }
}

let audioCtx = null
let unlockInstalled = false

function getCtx() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    audioCtx = audioCtx || new Ctx()
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    return audioCtx
  } catch {
    return null
  }
}

/** Call inside a real user tap (used by the Test button). */
export function ensureAudioUnlocked() {
  getCtx()
}

/**
 * Browsers block sound until the user interacts with the page.
 * Install once per dashboard: the first tap anywhere unlocks audio,
 * so the finish alarm can actually be heard.
 */
export function installAudioUnlock() {
  if (unlockInstalled || typeof window === 'undefined') return
  unlockInstalled = true
  const unlock = () => ensureAudioUnlocked()
  window.addEventListener('pointerdown', unlock, { passive: true })
  window.addEventListener('touchend', unlock, { passive: true })
  window.addEventListener('keydown', unlock)
}

/**
 * Classic timer alarm (WebAudio, no asset files needed): rapid,
 * high-pitched square-wave beeps like a kitchen/digital timer.
 * Long (~10 seconds) and loud. Respects the sound toggle.
 * Returns true if sound was played.
 */
export function playFinishChime(times = 32) {
  if (!isSoundEnabled()) return false
  try {
    const ctx = getCtx()
    if (!ctx) return false
    const now = ctx.currentTime + 0.05
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = 1046.5 // C6 — classic timer beep pitch
      const t = now + i * 0.3
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.32, t + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.17)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.2)
    }
    return true
  } catch {
    // Audio is best-effort (autoplay policies, headless envs).
    return false
  }
}

export function vibrateOnFinish() {
  try {
    // ~10s buzz pattern matching the alarm length (ignored on desktop).
    if (navigator.vibrate) {
      navigator.vibrate([
        400, 200, 400, 200, 400, 200, 400, 200, 400, 200, 400, 200, 400, 200,
        400, 200, 800,
      ])
    }
  } catch {
    // ignore
  }
}

export function inviteLinkFor(code) {
  // HashRouter is used (APK file:// compatible), so the route must sit
  // after /#/ — a plain /watch/CODE path would 404 on static hosts.
  const clean = normalizeCode(code)
  return `${window.location.origin}/#/watch/${clean}`
}
