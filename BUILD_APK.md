# Running the dashboard + building the Android APK

## A. Web dashboard (laptop / any browser)

```bash
npm install
cp .env.example .env   # fill in Firebase keys, see FIREBASE_SETUP.md
npm run dev            # dev server, edit src/ with hot reload
npm run build          # production build → dist/
npm run preview        # preview the production build locally
```

Deploy `dist/` anywhere static: Firebase Hosting, Netlify, Vercel, GitHub Pages.

### Editing on an Android phone with Acode

1. Open this project folder in Acode (it is plain Vite + React, no backend to run).
2. Edit files under `src/` — components, pages, styles.
3. To preview, run `npm run dev` in Termux (same phone) or sync the folder to a
   PC via git and run it there. The in-app preview in Acode works for static
   files; for the live Firebase timer use the dev server URL.

## B. Android APK via Capacitor

The app already uses `HashRouter`, so routing works inside the native WebView
(`file://`, no server needed). Capacitor config: `capacitor.config.json`
(`appId: com.synctimer.app`, `webDir: dist`). The `android/` platform folder
is already in this repo (`npx cap add android` was run).

> Honest note: Acode alone cannot compile an APK — that needs the Android SDK
> (Android Studio) or a cloud builder. Acode is for editing; build on a PC,
> or use an online Capacitor build service.

On a machine **with Android Studio + SDK** installed:

```bash
npm install          # installs @capacitor/* too
npm run build        # must succeed first; output goes to dist/
npx cap add android  # one time: creates the android/ project
npx cap sync         # or: npm run cap:sync — copies dist/ + plugins
npx cap open android # opens Android Studio → Run ▶ or Build → APK(s)
```

After changing web code, repeat: `npm run build && npx cap sync`.

### What the APK contains

The same app: home → **Admin** (create + control rooms) and **Viewer**
(join with code/link, watch-only, fullscreen button). Real Firebase sync —
no fake timers, no hardcoded participants. Presence (`participants/{uid}`)
is written live with `onDisconnect` cleanup, so the admin sees real
connected viewers.
