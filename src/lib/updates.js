import { APP_VERSION, REPO_URL } from './site'

const CHECK_KEY = 'synctimer-update-check'
const DISMISS_KEY = 'synctimer-update-dismissed'
const CHECK_INTERVAL = 24 * 60 * 60 * 1000 // once a day
const RELEASES_API =
  'https://api.github.com/repos/merjohnpagente/synctimer/releases/latest'

function parseVer(v) {
  return String(v || '')
    .replace(/^v/i, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0)
}

/** True when `latest` (e.g. v1.0.4) is newer than `current` (e.g. v1.0.3). */
export function isNewer(latest, current) {
  const a = parseVer(latest)
  const b = parseVer(current)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0
    const y = b[i] || 0
    if (x !== y) return x > y
  }
  return false
}

function evaluate(latest, url) {
  let dismissed = null
  try {
    dismissed = localStorage.getItem(DISMISS_KEY)
  } catch {
    // ignore
  }
  const updateAvailable =
    Boolean(latest) && isNewer(latest, APP_VERSION) && dismissed !== latest
  return { updateAvailable, latest, url }
}

/**
 * Check GitHub Releases for a newer APK. Cached for a day, never throws,
 * never blocks the UI — returns { updateAvailable, latest, url }.
 */
export async function checkForUpdate() {
  try {
    const raw = localStorage.getItem(CHECK_KEY)
    if (raw) {
      const cached = JSON.parse(raw)
      if (cached && cached.latest && Date.now() - cached.at < CHECK_INTERVAL) {
        return evaluate(cached.latest, cached.url)
      }
    }
  } catch {
    // ignore bad cache
  }
  try {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(RELEASES_API, { signal: ctrl.signal })
    clearTimeout(timeout)
    if (!res.ok) return { updateAvailable: false }
    const data = await res.json()
    const tag = data.tag_name || ''
    const asset = (data.assets || []).find((a) => a.name === 'SyncTimer.apk')
    const url = asset
      ? asset.browser_download_url
      : `${REPO_URL}/releases/download/${tag}/SyncTimer.apk`
    try {
      localStorage.setItem(
        CHECK_KEY,
        JSON.stringify({ at: Date.now(), latest: tag, url }),
      )
    } catch {
      // ignore
    }
    return evaluate(tag, url)
  } catch {
    // offline / rate-limited / blocked — stay silent
    return { updateAvailable: false }
  }
}

export function dismissUpdate(version) {
  try {
    localStorage.setItem(DISMISS_KEY, version)
  } catch {
    // ignore
  }
}
