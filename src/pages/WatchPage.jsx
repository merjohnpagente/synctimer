import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useRoom } from '../hooks/useRoom'
import { RoomErrorPanel, TimerSkeleton } from '../components/common'
import { ViewerDashboard } from '../components/ViewerDashboard'
import { pushRecentRoom } from '../lib/recent'

function loadName() {
  try {
    return localStorage.getItem('synctimer-name') || 'Guest'
  } catch {
    return 'Guest'
  }
}

/** Viewer route: read-only by design — no control actions are exposed. */
export function WatchPage({ uid, authReady }) {
  const { code } = useParams()
  const { room, loading, roomError, roomAccess, connected, mode, displayMs, effectiveStatus } =
    useRoom(code, uid, loadName())

  useEffect(() => {
    if (room && code) pushRecentRoom(code, 'viewer')
  }, [room, code])

  if (!authReady) {
    return (
      <div className="theme-viewer page-center">
        <p className="muted">Joining room…</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="theme-viewer page-center">
        <TimerSkeleton tone="light" />
        <p className="muted small">Loading room {code}…</p>
      </div>
    )
  }

  if (roomError || !room) {
    return (
      <div className="theme-viewer page-center">
        <RoomErrorPanel code={code} access={roomAccess} />
      </div>
    )
  }

  return (
    <ViewerDashboard
      code={code}
      room={room}
      mode={mode}
      remainingMs={displayMs}
      effectiveStatus={effectiveStatus}
      connected={connected}
    />
  )
}
