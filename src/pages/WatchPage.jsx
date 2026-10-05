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
  const { room, loading, roomError, connected, mode, displayMs, effectiveStatus } =
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
          There is no shared timer with code{' '}
          <strong className="chip-code">{code}</strong>
        </p>
        <div className="card notfound-card">
          <h2 className="card-title">Why am I seeing this?</h2>
          <ul className="dl-list">
            <li>The code may have a typo — check it with the host.</li>
            <li>
              The room may have been created in demo/offline mode, so it was
              never saved online.
            </li>
            <li>The host may have deleted it, or you may be offline.</li>
          </ul>
        </div>
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
      mode={mode}
      remainingMs={displayMs}
      effectiveStatus={effectiveStatus}
      connected={connected}
    />
  )
}
