import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, Upload, X } from 'lucide-react'

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
    return 'Camera blocked. Allow camera access for this site in your browser settings, then try again.'
  if (name === 'NotFoundError' || /no .*camera|device not found/i.test(msg))
    return 'No camera found on this device. Use “Upload QR image” below instead.'
  if (name === 'NotReadableError' || /in use|busy/i.test(msg))
    return 'Camera is busy (another app may be using it). Close it and try again.'
  return 'Could not start the camera. Use “Upload QR image” below instead.'
}

/**
 * Live camera QR scanner. Calls onScan(decodedText) once per successful scan.
 * Parent navigates away on success, which unmounts and stops the camera.
 */
export function QrScanner({ onScan, onClose }) {
  const [error, setError] = useState(null)
  const [starting, setStarting] = useState(true)
  const handledRef = useRef(false)
  const fileRef = useRef(null)
  const [scanMsg, setScanMsg] = useState(null)

  useEffect(() => {
    let cancelled = false
    let qr = null
    ;(async () => {
      try {
        if (
          typeof window !== 'undefined' &&
          window.isSecureContext === false
        ) {
          throw new Error(
            'Insecure page: the camera only works over HTTPS. Open the Vercel link (https://…) instead of plain http.',
          )
        }
        qr = new Html5Qrcode('synctimer-qr-reader')
        await qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 280, height: 280 } },
          (decodedText) => {
            if (cancelled || handledRef.current) return
            handledRef.current = true
            onScan(decodedText)
          },
          () => {
            // per-frame decode misses — ignore
          },
        )
        if (!cancelled) setStarting(false)
      } catch (err) {
        if (!cancelled) {
          setStarting(false)
          setError(friendlyCameraError(err))
          console.error('[SyncTimer] scanner failed:', err)
        }
      }
    })()
    return () => {
      cancelled = true
      if (qr) {
        try {
          const p = qr.stop()
          if (p && typeof p.catch === 'function') p.catch(() => {})
        } catch {
          // ignore
        }
        try {
          qr.clear()
        } catch {
          // ignore
        }
      }
    }
  }, [onScan])

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
      </div>
      {scanMsg && (
        <p className="error" role="alert">
          {scanMsg}
        </p>
      )}
    </div>
  )
}
