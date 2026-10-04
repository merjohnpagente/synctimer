import { HashRouter, Link, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { HomePage } from './pages/HomePage'
import { AdminPage } from './pages/AdminPage'
import { WatchPage } from './pages/WatchPage'

// HashRouter: works on Firebase Hosting AND inside the Capacitor
// Android WebView (file://), where BrowserRouter history breaks.
export default function App() {
  const { uid, ready, error } = useAuth()

  return (
    <HashRouter>
      <div className="app-shell">
        <Routes>
          <Route
            path="/"
            element={<HomePage uid={uid} authReady={ready} authError={error} />}
          />
          <Route
            path="/admin/:code"
            element={<AdminPage uid={uid} authReady={ready} />}
          />
          <Route
            path="/watch/:code"
            element={<WatchPage uid={uid} authReady={ready} />}
          />
          <Route
            path="*"
            element={
              <div className="theme-host page-center">
                <h1>Page not found</h1>
                <Link className="btn btn-primary" to="/">
                  Back home
                </Link>
              </div>
            }
          />
        </Routes>
        <footer className="app-footer">
          <span>SyncTimer · countdown rooms synced over Firebase</span>
        </footer>
      </div>
    </HashRouter>
  )
}
