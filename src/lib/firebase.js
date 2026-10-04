import { initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import {
  getDatabase,
  ref,
  serverTimestamp as rtdbServerTimestamp,
} from 'firebase/database'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(
  config.apiKey && config.databaseURL,
)

let app = null
let auth = null
let db = null

if (isFirebaseConfigured) {
  app = initializeApp(config)
  auth = getAuth(app)
  db = getDatabase(app)
}

export { app, auth, db }
export const serverTimestamp = rtdbServerTimestamp

/** Room paths in Realtime Database: rooms/{CODE} */
export function roomRef(code) {
  return ref(db, `rooms/${String(code).toUpperCase()}`)
}

export function participantsRef(code) {
  return ref(db, `rooms/${String(code).toUpperCase()}/participants`)
}

export function myPresenceRef(code, uid) {
  return ref(db, `rooms/${String(code).toUpperCase()}/participants/${uid}`)
}

/**
 * Ensure an anonymous user is signed in.
 * Resolves with the user (or null when Firebase is not configured -> demo mode).
 */
export function ensureAnonAuth() {
  return new Promise((resolve) => {
    if (!isFirebaseConfigured || !auth) {
      resolve(null)
      return
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        unsub()
        resolve(user)
        return
      }
      try {
        const cred = await signInAnonymously(auth)
        unsub()
        resolve(cred.user)
      } catch (err) {
        console.error('[SyncTimer] anonymous sign-in failed:', err)
        unsub()
        resolve(null)
      }
    })
  })
}
