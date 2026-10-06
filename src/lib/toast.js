/**
 * Minimal toast bus: call toast('message') from anywhere; <Toaster/> in
 * common.jsx renders them. No context/provider needed.
 */
export function toast(message, ms = 2600) {
  try {
    window.dispatchEvent(
      new CustomEvent('synctimer-toast', {
        detail: { message: String(message || ''), ms, id: `${Date.now()}-${Math.random()}` },
      }),
    )
  } catch {
    // ignore
  }
}

/** Light haptic tap (native-feel presses in the APK; silent on web). */
export function tapFeedback() {
  try {
    if (navigator.vibrate) navigator.vibrate(10)
  } catch {
    // ignore
  }
}
