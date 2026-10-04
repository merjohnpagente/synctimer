# Firebase setup (5–10 min, one time)

The app needs a Firebase project with **Realtime Database** + **Anonymous Auth**.
Without this, the app runs in demo mode (same-device only).

## 1. Create the project

1. Go to https://console.firebase.google.com → Add project (any name, e.g. `synctimer`).
2. Skip Google Analytics if you like.

## 2. Enable Anonymous Authentication

1. Build → **Authentication** → Get started.
2. Sign-in method → **Anonymous** → Enable → Save.
3. No login screens needed — the app signs users in silently and each user
   gets a stable `uid`. The room creator's `uid` becomes the `ownerId`
   (host identity).

## 3. Create the Realtime Database

1. Build → **Realtime Database** → Create Database.
2. Choose any region, start in **locked mode**.
3. Go to the **Rules** tab, replace everything with the contents of
   `database.rules.json` in this repo, Publish.

What the rules enforce (server-side, not just hidden buttons):

- Anyone signed in (anonymous counts) can **read** a room if they know the code.
- Only the **owner** (`ownerId === auth.uid`) can create that room and can
  ever change timer fields (`status`, `endsAt`, `remainingMs`, `durationMs`).
- Viewers can only write **their own** `participants/{uid}` presence entry.
- Anything else is rejected with `permission-denied`.

## 4. Register the web app + copy keys

1. Project settings (gear) → Your apps → **Web** (`</>`), nickname `synctimer-web`.
2. Copy the `firebaseConfig` values into a local `.env` file (see `.env.example`):

```bash
cp .env.example .env
```

```ini
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=....firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://....firebaseio.com
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

3. Restart the dev server after editing `.env`.

## 5. Test it

1. `npm run dev` → open the URL on your laptop → create a room (Admin).
2. Open the invite link / scan the QR on your phone → join as viewer.
3. Press Start on the laptop — the phone follows within ~1s.

## Data model (`rooms/{CODE}`)

```json
{
  "name": "Morning workout",
  "durationMs": 600000,
  "remainingMs": 600000,
  "status": "ready | running | paused | finished | ended",
  "endsAt": 1730000000000,
  "ownerId": "<host anonymous uid>",
  "createdAt": "<server timestamp>",
  "updatedAt": "<server timestamp>",
  "updatedBy": "<uid>",
  "participants": {
    "<uid>": { "name": "Alex", "role": "host|viewer", "joinedAt": "...", "lastSeen": "..." }
  }
}
```

Sync trick: the host writes one shared `endsAt` timestamp. Every client renders
`endsAt − now` locally on a 200 ms ticker, so all devices converge — including a
device that reconnects mid-timer. Nothing ticks on the server.
