import { Link } from 'react-router-dom'
import {
  BadgeCheck,
  Download,
  Eye,
  LayoutDashboard,
  Lock,
  Zap,
} from 'lucide-react'
import {
  APK_URL,
  APP_VERSION,
  DEVELOPER,
  RELEASES_URL,
  REPO_URL,
  isNativeApp,
} from '../lib/site'

/** Public download landing page: /download */
export function DownloadPage() {
  return (
    <div className="theme-host download">
      <header className="dl-hero">
        <div className="eyebrow">SyncTimer for Android</div>
        <h1>Get the app.</h1>
        <p className="muted">
          One shared countdown for every screen. Host from the admin dashboard,
          join as a viewer with a room code — all synced live over Firebase.{' '}
          <span className="chip chip-code">{APP_VERSION}</span>
        </p>
        <div className="dl-cta">
          {isNativeApp() ? (
            <p className="notice" role="note">
              <BadgeCheck
                size={18}
                aria-hidden="true"
                style={{ verticalAlign: '-3px' }}
              />{' '}
              You’re already using the SyncTimer app — no download needed.
            </p>
          ) : (
            <>
              <a className="btn btn-primary btn-big" href={APK_URL}>
                <Download size={20} aria-hidden="true" /> Download SyncTimer APK
              </a>
              <p className="muted small">
                Free · ~15 MB · Android 8.0+ · direct from GitHub Releases
              </p>
            </>
          )}
        </div>
      </header>

      <main className="dl-grid">
        <section className="card" aria-label="How to install">
          <h2 className="card-title">How to install</h2>
          <ol className="dl-steps">
            <li>Tap the download button above to get the APK file.</li>
            <li>Open the downloaded file and tap Install.</li>
            <li>
              If asked, allow <em>“Install unknown apps”</em> for your browser —
              the APK comes straight from our official GitHub release.
            </li>
            <li>Open SyncTimer and join a room with the code from your host.</li>
          </ol>
        </section>

        <section className="card" aria-label="What's inside">
          <h2 className="card-title">What’s inside</h2>
          <ul className="dl-list">
            <li>
              <LayoutDashboard size={18} aria-hidden="true" /> Admin dashboard —
              create rooms, Start / Pause / Resume / Reset
            </li>
            <li>
              <Eye size={18} aria-hidden="true" /> Viewer mode — big digits,
              fullscreen, watch-only
            </li>
            <li>
              <Zap size={18} aria-hidden="true" /> Real-time sync across phones,
              laptops &amp; tablets
            </li>
            <li>
              <Lock size={18} aria-hidden="true" /> Host-only controls enforced
              by database rules
            </li>
          </ul>
          <div className="dl-links">
            <a className="btn btn-ghost" href={RELEASES_URL}>
              All versions
            </a>
            <a className="btn btn-ghost" href={REPO_URL}>
              Source on GitHub
            </a>
            <Link className="btn btn-secondary" to="/">
              Open web app
            </Link>
          </div>
        </section>
      </main>

      <p className="dl-credit">Developed by {DEVELOPER}</p>
    </div>
  )
}
