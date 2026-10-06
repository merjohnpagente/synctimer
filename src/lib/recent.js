const RECENT_KEY = 'synctimer-recent-rooms'
const ONBOARD_KEY = 'synctimer-onboarded'
const PREFS_KEY = 'synctimer-prefs'
const MAX_RECENT = 5

function cleanCode(code) {
  return String(code || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12)
}

export function getRecentRooms() {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    if (!Array.isArray(v)) return []
    return v
      .filter((r) => r && r.code)
      .map((r) => ({ code: cleanCode(r.code), role: r.role === 'host' ? 'host' : 'viewer' }))
      .filter((r) => r.code)
      .slice(0, MAX_RECENT)
  } catch {
    return []
  }
}

export function pushRecentRoom(code, role = 'viewer') {
  const clean = cleanCode(code)
  if (!clean) return
  try {
    const list = [
      { code: clean, role: role === 'host' ? 'host' : 'viewer' },
      ...getRecentRooms().filter((r) => r.code !== clean),
    ].slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}

export function isOnboarded() {
  try {
    return localStorage.getItem(ONBOARD_KEY) === '1'
  } catch {
    return true
  }
}

export function setOnboarded() {
  try {
    localStorage.setItem(ONBOARD_KEY, '1')
  } catch {
    // ignore
  }
}

export function getPrefs() {
  try {
    const v = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

export function setPrefs(patch) {
  try {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ ...getPrefs(), ...(patch || {}) }),
    )
  } catch {
    // ignore
  }
}
