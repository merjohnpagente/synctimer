import { Link, useParams } from 'react-router-dom'
import { useRoom } from '../hooks/useRoom'
import { ViewerDashboard } from '../components/ViewerDashboard'

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
  const { room, loading, roomError, connected, remainingMs, effectiveStatus } =
    useRoom(code, uid, loadName())

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
        <p className="muted">Loading room {code}…</p>
      </div>
    )
  }

  if (roomError || !room) {
    return (
      <div className="theme-viewer page-center">
        <h1>Room not found</h1>
        <p className="muted">
          {roomError || 'Check the code and try again.'}
        </p>
        <Link className="btn btn-primary" to="/">
          Back home
        </Link>
      </div>
    )
  }

  return (
    <ViewerDashboard
      code={code}
      room={room}
      remainingMs={remainingMs}
      effectiveStatus={effectiveStatus}
      connected={connected}
    />
  )
}
