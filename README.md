# SyncTimer

One shared countdown for every screen. Built with **React + Vite + Firebase
Realtime Database**. Countdown-only.

- **Admin dashboard** (dark theme): create rooms, set duration, Start / Pause /
  Resume / Reset / End Session, room code + copyable invite link + QR, live
  connection status and real connected participants. Only the host can control
  the timer — enforced by Firebase Security Rules, not just hidden buttons.
- **Viewer app** (clean, minimalist, fullscreen-capable): join with a room code
  or invitation link, large readable digits, status
  Ready / Running / Paused / Finished / Ended, auto-syncs in real time.
  Zero control buttons — view-only by design.
- Same codebase ships to web **and** Android APK via Capacitor (`HashRouter`
  works from `file://` with no server).

## Quick start

```bash
npm install
cp .env.example .env   # add Firebase keys
npm run dev
```

- Admin creates a room → opens `/admin/KQ7X2P`
- Viewers join via `/watch/KQ7X2P` (link, code, or QR scan)

Docs:

- `FIREBASE_SETUP.md` — project, Anonymous Auth, Realtime Database, rules,
  data model, `.env` keys
- `BUILD_APK.md` — run the dashboard, edit in Acode, build the Android APK
- `database.rules.json` — host-only write rules (paste into Firebase console)
- `.env.example` — required `VITE_FIREBASE_*` keys

Without Firebase keys the app runs in **demo mode** (same-device try-out only).

## Project structure

```
src/
  lib/        firebase.js (RTDB + anon auth) · time.js (sync math, format, chime)
  hooks/      useAuth.js · useRoom.js (live subscription + host actions)
  components/ HostDashboard.jsx · ViewerDashboard.jsx · common.jsx (TimerFace…)
  pages/      HomePage.jsx · AdminPage.jsx (host-only) · WatchPage.jsx (view-only)
  App.jsx     HashRouter: / · /admin/:code · /watch/:code
capacitor.config.json   Android wrapper (appId com.synctimer.app, webDir dist)
android/                native Android project (open in Android Studio to build APK)
database.rules.json   Realtime Database Security Rules
```

## How sync works (real, no fakes)

The host writes a shared `endsAt` timestamp + `status` once per action.
Every client renders `endsAt − now` on a 200 ms ticker from the live RTDB
subscription — so phones, laptops, and tablets converge, including devices
that reconnect mid-timer. Participants are real presence entries
(`participants/{uid}` with `onDisconnect` cleanup), never hardcoded.
