// Single place to update on each release.
export const APP_VERSION = 'v1.0.13'
export const APK_URL =
  'https://github.com/merjohnpagente/synctimer/releases/download/v1.0.13/SyncTimer.apk'
export const RELEASES_URL =
  'https://github.com/merjohnpagente/synctimer/releases'
export const REPO_URL = 'https://github.com/merjohnpagente/synctimer'
export const DEVELOPER = 'Merjohn B. Pagente'

/**
 * True only inside the installed native app (Capacitor WebView injects
 * window.Capacitor). The public website never has it, so we can show
 * download CTAs on the website while hiding them inside the app itself.
 */
export function isNativeApp() {
  try {
    const cap = window.Capacitor
    return (
      cap != null &&
      typeof cap.isNativePlatform === 'function' &&
      cap.isNativePlatform() === true
    )
  } catch {
    return false
  }
}
