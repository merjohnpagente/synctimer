import { useEffect, useState } from 'react'
import { BellRing, Download, X } from 'lucide-react'
import { Browser } from '@capacitor/browser'
import { APP_VERSION, isNativeApp } from '../lib/site'
import { checkForUpdate, dismissUpdate } from '../lib/updates'

/**
 * Shows once when a newer APK exists on GitHub Releases.
 * Downloads the APK with progress, then the user taps the file to install —
 * the whole flow starts inside the app, no browser needed.
 */
export function UpdateBanner() {
  const [info, setInfo] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [viaBrowser, setViaBrowser] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    checkForUpdate().then((r) => {
      if (!cancelled && r.updateAvailable) setInfo(r)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!info) return null

  const download = async () => {
    setDownloading(true)
    setProgress(0)
    setError(null)
    // Inside the installed app, WebView fetch() of binary downloads is
    // unreliable (redirect/CORS handling) — open the file in the system
    // browser instead, which downloads it and prompts install on tap.
    if (isNativeApp()) {
      try {
        await Browser.open({ url: info.url })
        setDownloading(false)
        setViaBrowser(true)
        setDone(true)
      } catch (err) {
        setDownloading(false)
        setError(err?.message || 'Could not open the browser.')
      }
      return
    }
    try {
      const res = await fetch(info.url)
      if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`)
      let blob
      if (res.body && typeof res.body.getReader === 'function') {
        const total = Number(res.headers.get('content-length')) || 0
        const reader = res.body.getReader()
        const chunks = []
        let received = 0
        for (;;) {
          const { done: finished, value } = await reader.read()
          if (finished) break
          chunks.push(value)
          received += value.length
          if (total) setProgress(Math.round((received / total) * 100))
        }
        blob = new Blob(chunks, {
          type: 'application/vnd.android.package-archive',
        })
      } else {
        blob = await res.blob()
      }
      const obj = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = obj
      a.download = 'SyncTimer.apk'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(obj), 10000)
      setDownloading(false)
      setDone(true)
    } catch (err) {
      setDownloading(false)
      setError(err?.message || 'Download failed. Try again later.')
    }
  }

  const later = () => {
    dismissUpdate(info.latest)
    setInfo(null)
  }

  return (
    <div className="update-banner" role="alert">
      <div className="update-main">
        <BellRing size={22} aria-hidden="true" />
        <div>
          <strong>Update available: {info.latest}</strong>
          <div className="muted small">
            You have {APP_VERSION} — download and install the latest without
            leaving the app.
          </div>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {done ? (
        <p className="muted small">
          {viaBrowser ? (
            <>
              Opened in your browser — finish the download there, then open
              the <strong>SyncTimer.apk</strong> file to install.
            </>
          ) : (
            <>
              Downloaded! Open the <strong>SyncTimer.apk</strong> file to
              install (allow “Install unknown apps” if asked).
            </>
          )}
        </p>
      ) : downloading ? (
        <div>
          <div
            className="update-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Download progress"
          >
            <div style={{ width: `${progress}%` }} />
          </div>
          <p className="muted small">Downloading… {progress}%</p>
        </div>
      ) : (
        <div className="update-actions">
          <button
            type="button"
            className="btn btn-primary btn-small"
            onClick={download}
          >
            <Download size={16} aria-hidden="true" /> Download &amp; install
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={later}
            aria-label="Dismiss update notification"
          >
            <X size={16} aria-hidden="true" /> Later
          </button>
        </div>
      )}
    </div>
  )
}
