import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  onDisconnect,
  onValue,
  ref,
  serverTimestamp,
  set,
  update,
} from 'firebase/database'
import {
  db,
  isFirebaseConfigured,
  myPresenceRef,
  participantsRef,
  roomRef,
} from '../lib/firebase'
import {
  STATUS,
  clampDurationMs,
  computeElapsedMs,
  computeRemainingMs,
  generateRoomCode,
  normalizeCode,
} from '../lib/time'

function demoKey(code) {
  return `synctimer-demo-room-${normalizeCode(code)}`
}

function readDemoRoom(code) {
  try {
    const raw = localStorage.getItem(demoKey(code))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeDemoRoom(code, room) {
  try {
    localStorage.setItem(demoKey(code), JSON.stringify(room))
  } catch {
    // ignore
  }
}

/**
 * Subscribe to a room + drive a local 200ms ticker.
 * Works against RTDB, or localStorage-backed demo rooms when Firebase
 * env vars are missing (same-device try-out only).
 */
export function useRoom(code, uid, displayName = 'Guest') {
  const cleanCode = normalizeCode(code)
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [roomError, setRoomError] = useState(null)
  const [participants, setParticipants] = useState([])
  const [connected, setConnected] = useState(navigator.onLine !== false)
  const [now, setNow] = useState(() => Date.now())
  const finishWrittenRef = useRef(false)

  const isOwner = Boolean(room && uid && room.ownerId === uid)
  // Absent mode = countdown (rooms created before stopwatch existed).
  const mode = room && room.mode === 'stopwatch' ? 'stopwatch' : 'countdown'
  const isStopwatch = mode === 'stopwatch'
  const remainingMs = useMemo(
    () => computeRemainingMs(room, now),
    [room, now],
  )
  const elapsedMs = useMemo(() => computeElapsedMs(room, now), [room, now])
  // What the big digits show: count-up for stopwatch, count-down otherwise.
  const displayMs = isStopwatch ? elapsedMs : remainingMs
  const effectiveStatus = useMemo(() => {
    if (!room) return STATUS.READY
    if (
      room.status === STATUS.RUNNING &&
      typeof room.endsAt === 'number' &&
      room.endsAt <= Date.now() + 250
    ) {
      return STATUS.FINISHED
    }
    return room.status || STATUS.READY
  }, [room])

  // ---- live subscription ----
  useEffect(() => {
    if (!cleanCode) {
      setLoading(false)
      return undefined
    }
    setLoading(true)
    setRoomError(null)

    if (!isFirebaseConfigured) {
      const sync = () => {
        const found = readDemoRoom(cleanCode)
        setRoom(found)
        if (!found) setRoomError('Room not found on this device (demo mode).')
        setLoading(false)
      }
      sync()
      const onStorage = (e) => {
        if (e.key === demoKey(cleanCode)) sync()
      }
      window.addEventListener('storage', onStorage)
      const t = setInterval(sync, 1000)
      return () => {
        window.removeEventListener('storage', onStorage)
        clearInterval(t)
      }
    }

    const rref = roomRef(cleanCode)
    const unsubRoom = onValue(
      rref,
      (snap) => {
        const val = snap.val()
        if (!val) {
          setRoomError('Room not found. Check the code.')
          setRoom(null)
        } else {
          setRoom(val)
          setRoomError(null)
        }
        setLoading(false)
      },
      (err) => {
        setRoomError(err?.message || 'Failed to load room.')
        setLoading(false)
      },
    )

    const plistRef = participantsRef(cleanCode)
    const unsubList = onValue(plistRef, (snap) => {
      const val = snap.val() || {}
      const list = Object.entries(val).map(([id, p]) => ({ id, ...p }))
      list.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))
      setParticipants(list)
    })

    const connRef = ref(db, '.info/connected')
    const unsubConn = onValue(connRef, (snap) => {
      setConnected(snap.val() === true)
    })

    return () => {
      unsubRoom()
      unsubList()
      unsubConn()
    }
  }, [cleanCode])

  // ---- presence (viewers + host announce themselves) ----
  useEffect(() => {
    if (!cleanCode || !uid || !room) return undefined
    if (!isFirebaseConfigured) return undefined
    let cancelled = false
    const presence = myPresenceRef(cleanCode, uid)
    const role = room.ownerId === uid ? 'host' : 'viewer'
    set(presence, {
      name: displayName || 'Guest',
      role,
      joinedAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
    }).catch(() => {})
    onDisconnect(presence)
      .remove()
      .catch(() => {})
    const heartbeat = setInterval(() => {
      if (!cancelled) {
        update(presence, { lastSeen: serverTimestamp() }).catch(() => {})
      }
    }, 20000)
    return () => {
      cancelled = true
      clearInterval(heartbeat)
      set(presence, null).catch(() => {})
    }
  }, [cleanCode, uid, displayName, room?.ownerId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- local ticker (recompute remaining; refresh on visibility change) ----
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const t = setInterval(tick, 200)
    const onVis = () => tick()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('online', tick)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('online', tick)
    }
  }, [])

  // ---- host auto-marks finished when the countdown hits zero ----
  // (countdown only — a stopwatch never finishes on its own)
  useEffect(() => {
    if (!room || !isOwner || isStopwatch) return
    if (room.status !== STATUS.RUNNING) {
      finishWrittenRef.current = false
      return
    }
    if (typeof room.endsAt !== 'number') return
    if (Date.now() < room.endsAt) {
      finishWrittenRef.current = false
      return
    }
    if (finishWrittenRef.current) return
    finishWrittenRef.current = true
    markFinished().catch(() => {
      finishWrittenRef.current = false
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status, room?.endsAt, isOwner, isStopwatch])

  const guardOwner = useCallback(() => {
    if (!room) throw new Error('Room not loaded yet.')
    if (!uid) throw new Error('Not signed in yet.')
    if (room.ownerId !== uid) {
      throw new Error('Only the host can control this timer.')
    }
  }, [room, uid])

  const writeRoom = useCallback(
    async (patch) => {
      if (!isFirebaseConfigured) {
        const current = readDemoRoom(cleanCode)
        if (!current) throw new Error('Room not found.')
        if (current.ownerId !== uid) {
          throw new Error('Only the host can control this timer.')
        }
        writeDemoRoom(cleanCode, {
          ...current,
          ...patch,
          updatedAt: Date.now(),
          updatedBy: uid,
        })
        setRoom(readDemoRoom(cleanCode))
        return
      }
      await update(roomRef(cleanCode), {
        ...patch,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      })
    },
    [cleanCode, uid],
  )

  const start = useCallback(async () => {
    guardOwner()
    if (isStopwatch) {
      const base =
        room.status === STATUS.PAUSED
          ? (typeof room.elapsedBaseMs === 'number' ? room.elapsedBaseMs : 0)
          : 0
      await writeRoom({
        status: STATUS.RUNNING,
        startedAt: Date.now(),
        elapsedBaseMs: Math.max(0, base),
      })
      return
    }
    const base = room.status === STATUS.PAUSED ? room.remainingMs : room.durationMs
    const safe = clampDurationMs(base ?? room.durationMs)
    await writeRoom({
      status: STATUS.RUNNING,
      endsAt: Date.now() + safe,
      remainingMs: safe,
    })
  }, [guardOwner, room, writeRoom, isStopwatch])

  const pause = useCallback(async () => {
    guardOwner()
    if (room.status !== STATUS.RUNNING) return
    if (isStopwatch) {
      const elapsed =
        typeof room.startedAt === 'number'
          ? Math.max(0, (room.elapsedBaseMs ?? 0) + (Date.now() - room.startedAt))
          : (room.elapsedBaseMs ?? 0)
      await writeRoom({
        status: STATUS.PAUSED,
        elapsedBaseMs: elapsed,
        startedAt: null,
      })
      return
    }
    const left =
      typeof room.endsAt === 'number'
        ? Math.max(0, room.endsAt - Date.now())
        : (room.remainingMs ?? 0)
    await writeRoom({ status: STATUS.PAUSED, remainingMs: left, endsAt: null })
  }, [guardOwner, room, writeRoom, isStopwatch])

  const resume = useCallback(async () => {
    guardOwner()
    if (room.status !== STATUS.PAUSED) return
    if (isStopwatch) {
      await writeRoom({
        status: STATUS.RUNNING,
        startedAt: Date.now(),
        elapsedBaseMs: Math.max(0, room.elapsedBaseMs ?? 0),
      })
      return
    }
    const safe = Math.max(0, room.remainingMs ?? 0)
    await writeRoom({
      status: STATUS.RUNNING,
      endsAt: Date.now() + safe,
      remainingMs: safe,
    })
  }, [guardOwner, room, writeRoom, isStopwatch])

  const reset = useCallback(async () => {
    guardOwner()
    if (isStopwatch) {
      await writeRoom({
        status: STATUS.READY,
        elapsedBaseMs: 0,
        startedAt: null,
      })
      return
    }
    await writeRoom({
      status: STATUS.READY,
      remainingMs: room.durationMs,
      endsAt: null,
    })
  }, [guardOwner, room, writeRoom, isStopwatch])

  const adjust = useCallback(
    async (deltaMs) => {
      guardOwner()
      // Countdown only — a stopwatch has no target to adjust.
      if (isStopwatch) return
      if (room.status === STATUS.RUNNING || room.status === STATUS.ENDED) return
      const next = clampDurationMs((room.remainingMs ?? room.durationMs) + deltaMs)
      const patch = { remainingMs: next }
      if (room.status === STATUS.READY) {
        patch.durationMs = next
      }
      await writeRoom(patch)
    },
    [guardOwner, room, writeRoom, isStopwatch],
  )

  const markFinished = useCallback(async () => {
    guardOwner()
    await writeRoom({ status: STATUS.FINISHED, remainingMs: 0, endsAt: null })
  }, [guardOwner, writeRoom])

  const endSession = useCallback(async () => {
    guardOwner()
    await writeRoom({ status: STATUS.ENDED, endsAt: null })
  }, [guardOwner, writeRoom])

  return {
    room,
    loading,
    roomError,
    participants,
    connected,
    now,
    mode,
    remainingMs,
    elapsedMs,
    displayMs,
    effectiveStatus,
    isOwner,
    actions: { start, pause, resume, reset, adjust, endSession },
  }
}

/**
 * Create a new room (caller becomes host/owner).
 * Stopwatch-only fields are written ONLY for stopwatch rooms, so rooms
 * created for countdown keep the exact old shape (old DB rules keep working).
 */
export async function createRoom({ name, durationMs, ownerId, mode }) {
  const code = generateRoomCode()
  const safe = clampDurationMs(durationMs)
  const isSW = mode === 'stopwatch'
  const payload = {
    name: String(name || 'Untitled timer').slice(0, 80),
    durationMs: safe,
    remainingMs: safe,
    status: STATUS.READY,
    endsAt: null,
    ownerId,
    ...(isSW ? { mode: 'stopwatch', startedAt: null, elapsedBaseMs: 0 } : {}),
    createdAt: isFirebaseConfigured ? serverTimestamp() : Date.now(),
    updatedAt: isFirebaseConfigured ? serverTimestamp() : Date.now(),
    updatedBy: ownerId,
  }
  if (!isFirebaseConfigured) {
    writeDemoRoom(code, payload)
    return code
  }
  await set(roomRef(code), payload)
  return code
}
