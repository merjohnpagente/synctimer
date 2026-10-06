import { Suspense, lazy } from 'react'
import { HashRouter, Link, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { HomePage } from './pages/HomePage'
import { Toaster } from './components/common'
import { APP_VERSION, DEVELOPER } from './lib/site'

const AdminPage = lazy(() =>
  import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })),
)
const WatchPage = lazy(() =>
  import('./pages/WatchPage').then((m) => ({ default: m.WatchPage })),
)
const DownloadPage = lazy(() =>
  import('./pages/DownloadPage').then((m) => ({ default: m.DownloadPage })),
)

function PageLoading() {
  return (
    <div className="page-center">
      <p className="muted">Loading…</p>
    </div>
  )
}

// HashRouter: works on Firebase Hosting AND inside the Capacitor
// Android WebView (file://), where BrowserRouter history breaks.
export default function App() {
  const { uid, ready, error } = useAuth()

  return (
    <HashRouter>
      <div className="app-shell">
        <Suspense fallback={<PageLoading />}>
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
            <Route path="/download" element={<DownloadPage />} />
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
        </Suspense>
        <footer className="app-footer">
          <span>
            SyncTimer {APP_VERSION} · Developed by {DEVELOPER}
          </span>
        </footer>
        <Toaster />
      </div>
    </HashRouter>
  )
}
