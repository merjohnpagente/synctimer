/**
 * Countdown-only time utilities.
 * Sync model: the host writes { status, endsAt, remainingMs } with endsAt in
 * Firebase SERVER time. Every client renders remaining = endsAt - serverNow
 * (device clock + .info/serverTimeOffset), so phones with wrong clocks still
 * stay in sync without syncing every tick. Stopwatch rooms use
 * { status, startedAt, elapsedBaseMs } the same way (count-up).
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
 * Looping timer alarm (WebAudio, no mp3 file needed): schedules short
 * square-wave beeps (880Hz, 0.15s every 0.3s) for `durationSec`, just like a
 * classic timer. Call stopAlarm() to silence it early (Stop button).
 * Respects the sound toggle. Returns true if the alarm started.
 */
let alarmCtx = null
let alarmTimer = null

export function playAlarm(durationSec = 10) {
  if (!isSoundEnabled()) return false
  try {
    stopAlarm()
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return false
    const ctx = new Ctx()
    if (ctx.state === 'suspended') void ctx.resume()
    alarmCtx = ctx
    const end = ctx.currentTime + Math.max(1, durationSec)
    let t = ctx.currentTime + 0.05
    while (t < end) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.015)
      gain.gain.setValueAtTime(0.3, t + 0.15)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.2)
      t += 0.3
    }
    alarmTimer = setTimeout(stopAlarm, (Math.max(1, durationSec) + 1) * 1000)
    return true
  } catch {
    return false
  }
}

/** Silence a running alarm (also frees the AudioContext). */
export function stopAlarm() {
  if (alarmTimer) {
    clearTimeout(alarmTimer)
    alarmTimer = null
  }
  if (alarmCtx) {
    const ctx = alarmCtx
    alarmCtx = null
    try {
      const p = ctx.close()
      if (p && typeof p.catch === 'function') p.catch(() => {})
    } catch {
      // ignore
    }
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

/**
 * True only inside the installed native app (Capacitor WebView injects
 * window.Capacitor). The public website never has it.
 */
export function isNativeApp() {
  try {
    const cap = window.Capacitor
    return (
      cap != null &&
      typeof cap.isNativePlatform === 'function' &&
      cap.isNativePlatform() === true
    )
  } catch {
    return false
  }
}

// Public website origin used for share links. Inside the native app,
// window.location.origin is https://localhost (useless to share), so we
// use the real website address instead (overridable via env).
const PUBLIC_WEB_ORIGIN = 'https://johntimer.vercel.app'

export function inviteLinkFor(code) {
  // HashRouter is used (APK file:// compatible), so the route must sit
  // after /#/ — a plain /watch/CODE path would 404 on static hosts.
  const clean = normalizeCode(code)
  const origin = isNativeApp()
    ? String(
        import.meta.env.VITE_PUBLIC_WEB_URL || PUBLIC_WEB_ORIGIN,
      ).replace(/\/$/, '')
    : window.location.origin
  return `${origin}/#/watch/${clean}`
}
