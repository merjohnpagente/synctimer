import { useCallback, useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, Copy, ExternalLink, Upload, X } from 'lucide-react'

/**
 * Pull a room code out of scanned text. Accepts our full invite links
 * (https://host/#/watch/ABC123), plain /watch/ABC123 paths, or a raw code.
 */
export function extractCodeFromScan(text) {
  const t = String(text || '').trim()
  let m = t.match(/#\/watch\/([A-Za-z0-9]{2,12})/)
  if (m) return m[1].toUpperCase()
  m = t.match(/\/watch\/([A-Za-z0-9]{2,12})/)
  if (m) return m[1].toUpperCase()
  return t
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12)
}

/**
 * Human-readable reason why the camera would not start.
 */
function friendlyCameraError(err) {
  const name = err?.name || ''
  const msg = String(err?.message || '')
  if (/secure|https/i.test(msg))
    return 'Insecure page: the camera only works over HTTPS. Open the Vercel link (https://…) instead of plain http.'
  if (name === 'NotAllowedError' || /denied|permission/i.test(msg))
    return 'Camera blocked. Allow camera access for this site in your browser settings, then try again — or use “Upload QR image” below.'
  if (name === 'NotFoundError' || /no .*camera|device not found/i.test(msg))
    return 'No camera found on this device. Use “Upload QR image” below instead.'
  if (name === 'NotReadableError' || /in use|busy/i.test(msg))
    return 'Camera is busy (another app may be using it). Close it and try again.'
  return 'Could not start the camera. Try another camera below, or use “Upload QR image”.'
}

/** In-app browsers (Messenger/Facebook/Instagram) usually block the camera. */
function isInAppBrowser() {
  try {
    const ua = navigator.userAgent || ''
    return /FBAN|FBAV|FB_IAB|Instagram|Line\/|MiuiBrowser|Quark/i.test(ua)
  } catch {
    return false
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Live camera QR scanner with camera selector + constraint fallbacks +
 * photo-upload fallback. Calls onScan(decodedText) once per success.
 * Parent navigates away on success, which unmounts and stops the camera.
 */
export function QrScanner({ onScan, onClose }) {
  const [error, setError] = useState(null)
  const [starting, setStarting] = useState(true)
  const [cameras, setCameras] = useState([])
  const [scanMsg, setScanMsg] = useState(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [inApp] = useState(() => isInAppBrowser())
  const handledRef = useRef(false)
  const fileRef = useRef(null)
  const cancelledRef = useRef(false)
  const scannerRef = useRef(null)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  const stopScanner = async () => {
    const qr = scannerRef.current
    scannerRef.current = null
    if (!qr) return
    try {
      const p = qr.stop()
      if (p && typeof p.catch === 'function') await p.catch(() => {})
    } catch {
      // ignore
    }
    try {
      qr.clear()
    } catch {
      // ignore
    }
  }

  const boot = useCallback(async (targetId) => {
    await stopScanner()
    if (cancelledRef.current) return
    setStarting(true)
    setError(null)
    try {
      if (typeof window !== 'undefined' && window.isSecureContext === false) {
        throw new Error(
          'Insecure page: the camera only works over HTTPS. Open the Vercel link (https://…) instead of plain http.',
        )
      }
      const qr = new Html5Qrcode('synctimer-qr-reader')
      scannerRef.current = qr
      // Try back camera first, then any camera — never fail on one bad guess.
      const attempts =
        targetId && targetId !== 'auto'
          ? [{ deviceId: { exact: targetId } }, { deviceId: targetId }]
          : [
              { facingMode: { exact: 'environment' } },
              { facingMode: { ideal: 'environment' } },
              {},
            ]
      let lastErr = null
      let started = false
      for (const constraint of attempts) {
        try {
          await qr.start(
            constraint,
            { fps: 10, qrbox: { width: 280, height: 280 } },
            (decodedText) => {
              if (cancelledRef.current || handledRef.current) return
              handledRef.current = true
              onScanRef.current(decodedText)
            },
            () => {
              // per-frame decode misses — ignore
            },
          )
          started = true
          break
        } catch (e) {
          lastErr = e
        }
      }
      if (!started) throw lastErr
      if (!cancelledRef.current) setStarting(false)
    } catch (err) {
      if (!cancelledRef.current) {
        setStarting(false)
        setError(friendlyCameraError(err))
        console.error('[SyncTimer] scanner failed:', err)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // List cameras once, prefer a rear one, then start.
  useEffect(() => {
    cancelledRef.current = false
    ;(async () => {
      let list = []
      try {
        list = await Html5Qrcode.getCameras()
      } catch {
        // getCameras needs permission on some browsers — boot() retries anyway
      }
      if (cancelledRef.current) return
      const found = list || []
      setCameras(found)
      const rear = found.find((c) => /back|rear|environment/i.test(c.label || ''))
      await boot(rear ? rear.id : 'auto')
    })()
    return () => {
      cancelledRef.current = true
      stopScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boot])

  const switchCamera = (id) => {
    handledRef.current = false
    boot(id)
  }

  // Fallback: decode a QR from an uploaded photo/screenshot.
  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file || handledRef.current) return
    setScanMsg(null)
    try {
      const text = await Html5Qrcode.scanFile(file, /* showImage= */ false)
      handledRef.current = true
      onScan(text)
    } catch {
      setScanMsg('No QR code found in that image. Try a clearer photo.')
    }
  }

  const copyLink = async () => {
    const ok = await copyText(window.location.href)
    if (ok) {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }

  return (
    <div className="scanner-panel" role="dialog" aria-label="Scan QR code">
      <div className="scanner-head">
        <span className="scanner-title">
          <Camera size={18} aria-hidden="true" /> Scan room QR
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={onClose}
          aria-label="Close scanner"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {inApp && (
        <p className="notice" role="note">
          You seem to be inside Facebook/Messenger’s browser, which blocks the
          camera. Tap below to copy this page’s link, then open it in{' '}
          <strong>Chrome</strong> and scan from there.
          <br />
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={copyLink}
            style={{ marginTop: 8 }}
          >
            <Copy size={14} aria-hidden="true" />{' '}
            {linkCopied ? 'Link copied!' : 'Copy page link'}
          </button>
        </p>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {!error && (
        <>
          {starting && <p className="muted small">Starting camera…</p>}
          <div id="synctimer-qr-reader" className="qr-reader" />
          <p className="muted small">
            Point your camera at the host’s QR code — or upload a photo below.
          </p>
        </>
      )}

      {cameras.length > 1 && (
        <label className="field">
          <span className="field-label">Camera</span>
          <select
            className="input"
            onChange={(e) => switchCamera(e.target.value)}
            defaultValue=""
            aria-label="Choose camera"
          >
            <option value="" disabled>
              Switch camera…
            </option>
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {(c.label || 'Camera').slice(0, 60)}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="scanner-upload">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={onFile}
          aria-label="Upload QR image"
        />
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => fileRef.current && fileRef.current.click()}
        >
          <Upload size={16} aria-hidden="true" /> Upload QR image
        </button>
        <a
          className="btn btn-ghost btn-small"
          href={window.location.href}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={14} aria-hidden="true" /> Open in browser
        </a>
      </div>
      {scanMsg && (
        <p className="error" role="alert">
          {scanMsg}
        </p>
      )}
    </div>
  )
}
