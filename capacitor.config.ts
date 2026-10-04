import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.synctimer.app',
  appName: 'SyncTimer',
  // Capacitor copies this folder into the native WebView.
  webDir: 'dist',
  // HashRouter is used so routing works from file:// with no server.
  server: {
    androidScheme: 'https',
  },
}

export default config
