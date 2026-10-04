import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, X } from 'lucide-react'

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
 * Live camera QR scanner. Calls onScan(decodedText) once per successful scan.
 * Parent navigates away on success, which unmounts and stops the camera.
 */
export function QrScanner({ onScan, onClose }) {
  const [error, setError] = useState(null)
  const [starting, setStarting] = useState(true)
  const handledRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    let qr = null
    ;(async () => {
      try {
        qr = new Html5Qrcode('synctimer-qr-reader')
        await qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
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
          setError(
            'Camera unavailable. Allow camera access and use HTTPS (or localhost), then try again.',
          )
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
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : (
        <>
          {starting && <p className="muted small">Starting camera…</p>}
          <div id="synctimer-qr-reader" className="qr-reader" />
          <p className="muted small">
            Point your camera at the host’s QR code.
          </p>
        </>
      )}
    </div>
  )
}
