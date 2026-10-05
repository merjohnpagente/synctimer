import { Link, useParams } from 'react-router-dom'
import { useRoom } from '../hooks/useRoom'
import { HostDashboard } from '../components/HostDashboard'
import { isFirebaseConfigured } from '../lib/firebase'

function loadName() {
  try {
    return localStorage.getItem('synctimer-name') || 'Host'
  } catch {
    return 'Host'
  }
}

/** Admin route: only the room owner gets controls. */
export function AdminPage({ uid, authReady }) {
  const { code } = useParams()
  const { room, loading, roomError, participants, connected, mode, displayMs, effectiveStatus, isOwner, actions } =
    useRoom(code, uid, loadName())

  if (!authReady) {
    return (
      <div className="theme-host page-center">
        <p className="muted">Signing you in…</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="theme-host page-center">
        <p className="muted">Loading room {code}…</p>
      </div>
    )
  }

  if (roomError || !room) {
    return (
      <div className="theme-host page-center">
        <h1>Room not found</h1>
        <p className="muted">
          There is no shared timer with code{' '}
          <strong className="chip-code">{code}</strong>
        </p>
        <p className="muted small">
          If you just created this room while the app was in demo mode, it was
          only saved in this browser — create a fresh room to share online.
        </p>
        <Link className="btn btn-primary" to="/">
          Back home
        </Link>
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="theme-host page-center">
        <h1>Host access only</h1>
        <p className="muted">
          This room belongs to another host. You can join it as a viewer
          instead — viewers can never control the timer.
        </p>
        <Link className="btn btn-primary" to={`/watch/${code}`}>
          Open viewer instead
        </Link>
      </div>
    )
  }

  return (
    <HostDashboard
      code={code}
      room={room}
      mode={mode}
      remainingMs={displayMs}
      effectiveStatus={effectiveStatus}
      participants={participants}
      connected={connected}
      actions={actions}
      demo={!isFirebaseConfigured}
    />
  )
}
