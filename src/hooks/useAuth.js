import { useEffect, useState } from 'react'
import { ensureAnonAuth, isFirebaseConfigured } from '../lib/firebase'

/**
 * Anonymous sign-in (no-login MVP).
 * Returns stable uid used as owner identity + presence key.
 */
export function useAuth() {
  const [uid, setUid] = useState(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!isFirebaseConfigured) {
      // Demo mode: stable local identity so host/viewer logic still works.
      let localId = null
      try {
        localId =
          localStorage.getItem('synctimer-demo-uid') ||
          `demo-${Math.random().toString(36).slice(2, 10)}`
        localStorage.setItem('synctimer-demo-uid', localId)
      } catch {
        localId = `demo-${Math.random().toString(36).slice(2, 10)}`
      }
      setUid(localId)
      setReady(true)
      return undefined
    }
    ensureAnonAuth()
      .then((user) => {
        if (cancelled) return
        if (!user) {
          setError(
            'Sign-in failed. Check Firebase Auth (Anonymous provider) and API key.',
          )
        } else {
          setUid(user.uid)
        }
        setReady(true)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.message || 'Sign-in failed.')
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { uid, ready, error, demo: !isFirebaseConfigured }
}
