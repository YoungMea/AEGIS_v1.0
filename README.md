# AEGIS — Classified OSINT Intelligence Platform

A cinematic full-stack OSINT/intelligence dossier system built for educational
and research use. Looks and feels like a confidential agency console: dark
tactical UI, secure authentication, OTP enrollment, encrypted dossiers, an
internal operative-to-operative chat channel, and a Gemini-powered image
intelligence module.

> ⚠️ **Educational only.** This is not a production intelligence tool. Use it
> to learn full-stack development, authentication flows, encryption patterns,
> and design systems.

---

## Features

- 🔐 **JWT authentication** with bcrypt password hashing (cost factor 12 by default)
- 🔒 **NoLook** — application-layer AES-256-GCM encryption for sensitive
  dossier fields and every chat message
- 📱 **OTP enrollment** via Telegram bot (default), SMS, or simulated mode
- 🆔 **UID recovery** — forgot UID? Telegram-based reset
- 💾 **Telegram backups** — hourly encrypted snapshots of the database
  shipped to a private chat, auto-restored on cold start (defeats Render's
  ephemeral filesystem)
- 🪪 **Numeric UID assignment** (8 digits) used as login identifier
- 🗂 **Dossier management** — classification, risk level, status, tags,
  multi-image evidence gallery with lightbox
- 🖋 **Realistic intelligence document editor** — paper textures, stamps,
  barcodes, scanning animation, image upload, timeline, connections, more
- 💬 **AntChat** — real-time encrypted operative-to-operative messaging
  via Server-Sent Events (text, files up to 2 MB, dossier snapshots)
- 🦉 **OwlSight** — image OSINT module: EXIF metadata extraction, on-device
  OCR (Tesseract.js), and Gemini-powered AI scene + geographic guess
- 👥 **Operative directory** — search by partial UID *or* codename
- 👤 **Profile** — avatar (with on-device downscale), bio, status
- 📋 **Audit log** — every dossier, login, password change, message — your
  own activity feed
- 🔔 **Notifications** — native browser push + tactical sound layer for
  AntChat, fully opt-in
- ⚡ **Adaptive performance mode** — strips animations and blurs on weak
  devices automatically (low / medium / high tiers)
- 📰 **In-app news bulletin** with cinematic SVG covers
- 🎧 **Support** — Telegram-based help channel
- 🌐 **Trilingual** — UZ / RU / EN, accessible without login
- 🛡 **Hardened API** — rate limiting, Zod validation, ownership scoping,
  no user enumeration on auth endpoints
- 🌗 **Dark cinematic UI** — Tailwind, Framer Motion, Lucide icons,
  custom fonts (Inter, JetBrains Mono, Orbitron)
- 📱 **Fully responsive** — mobile, tablet, desktop, ultrawide
- 🖨 **Print/Export PDF** with a print-aware stylesheet
- 🖥 **Desktop client** — Electron shell for Windows (.exe) and Linux
  (.AppImage / .deb)

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 15 (App Router, Server Components) |
| Language | TypeScript |
| Frontend | React 19, TailwindCSS, Framer Motion, Lucide Icons |
| Backend | Next.js Route Handlers (Node runtime) |
| Database | SQLite (`better-sqlite3`) — schema is Postgres-compatible |
| Auth | JWT (HS256) + bcrypt + httpOnly cookies |
| Encryption | AES-256-GCM via Node `crypto` (NoLook layer) |
| Real-time | Server-Sent Events + in-memory pub/sub |
| Image AI | Google Gemini 1.5 Flash (vision) |
| OCR | Tesseract.js (browser-side) |
| EXIF | exifr (server-side) |
| Validation | Zod |
| Desktop | Electron 33 + electron-builder |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env and adjust values
cp .env.example .env
# at minimum, set JWT_SECRET to a long random string and add the Telegram
# verification bot token + username.

# 3. Initialize the SQLite database (auto-runs on first request anyway)
npm run db:init

# 4. Start the dev server
npm run dev
```

Open http://localhost:3000

You will land on the **Login** screen. Tap **Request enrollment** to:

1. Enter a phone number (format `+998901234567`)
2. Open the verification bot once via the deep-link button
3. Receive a 6-digit code in Telegram
4. Set a strong password
5. The system assigns a unique 8-digit UID and signs you in

Forgot the UID later? Tap **Forgot UID?** on login and recover it by phone.
Tick **Remember UID on this device** and the field auto-fills next time.

---

## Modules

### My Database
Browse, filter and manage classified dossiers as folders. Status, risk
level and tag filters keep large archives organised.

### Add Information
Full-screen investigation document editor: image upload, sections for
identity, geolocation, digital footprint, timeline, connections,
**multi-image evidence gallery** and tags. Save, archive, print or
export to PDF. Sensitive fields are encrypted on disk via NoLook.

### Find Friends
Look up other operatives by partial UID or codename. Click any result
to jump straight into AntChat.

### AntChat
Real-time encrypted messaging powered by SSE. Three message kinds:
- **Text** (up to 4 000 characters)
- **File** — pictures, PDFs, evidence up to **2 MB**, stored encrypted
- **Dossier** — read-only snapshot of any of your dossiers

Bodies, attachments and snapshots are encrypted with NoLook. Online
indicators, unread counters and a floating chat button (FAB) on every
screen keep operatives in the loop.

### OwlSight 🦉
Image OSINT. Drop a photo and get three panels:
- **AI Analysis** — Gemini scene description, object list, geographic
  guess with confidence + reasoning
- **Geolocation** — embedded OpenStreetMap when GPS is in EXIF, AI
  estimate otherwise
- **Metadata** — camera, lens, ISO, exposure, dimensions
- **OCR** — on-device Tesseract reads any visible text

Privacy-first: OCR stays in the browser, Gemini calls are stateless,
images are never persisted on the server.

### News
In-app bulletin with announcements and module previews. Each story has
a tactical SVG cover and a long-form modal with highlights.

### Support
Reach the team via the configured Telegram support bot, or paste a
quick message into the form — it copies to your clipboard so you can
forward it inside Telegram.

### Profile + My Activity
Manage your avatar, codename and bio. Review every action you've taken
in AEGIS in a chronological audit feed grouped by day, with the option
to load older entries.

---

## Configuration

All knobs live in `.env`. See `.env.example` for the full list.

| Variable | Default | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | dev-only fallback | Secret used to sign session JWTs |
| `JWT_EXPIRES_IN` | `7d` | Session lifetime |
| `NOLOOK_KEY` | (derived from `JWT_SECRET`) | AES-256-GCM master key. **Set to a separate value in production** for defence-in-depth. |
| `DATABASE_URL` | `./data/aegis.db` | SQLite file path |
| `OTP_CHANNEL` | `telegram` | `telegram` · `sms` · `simulate` |
| `OTP_LENGTH` | `6` | Digits in the OTP code |
| `OTP_TTL_SECONDS` | `300` | OTP validity window |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost |
| `TELEGRAM_BOT_TOKEN` | — | Token from @BotFather |
| `TELEGRAM_BOT_USERNAME` | — | Bot username (no `@`) |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | — | Same value, exposed to the browser |
| `NEXT_PUBLIC_TELEGRAM_SUPPORT_BOT_USERNAME` | — | Support bot username |
| `AEGIS_BACKUP_CHAT_ID` | — | Telegram chat that receives encrypted DB backups |
| `AEGIS_BACKUP_INTERVAL_MS` | `3600000` | How often to upload a snapshot |
| `AEGIS_ADMIN_UID` | — | UID allowed to call backup APIs (defaults to first operative) |
| `GEMINI_API_KEY` | — | Google AI Studio key — enables OwlSight's AI panel |
| `TWILIO_ACCOUNT_SID` | — | Required when `OTP_CHANNEL=sms` |
| `TWILIO_AUTH_TOKEN` | — | Required when `OTP_CHANNEL=sms` |
| `TWILIO_FROM_NUMBER` | — | Required when `OTP_CHANNEL=sms` |

### Telegram channel (recommended)

The default flow uses a Telegram bot to deliver OTPs.

1. Create a bot via [@BotFather](https://t.me/BotFather) → `/newbot`.
2. Copy the `123:ABC...` token and the bot's username.
3. Set the env values:
   ```env
   OTP_CHANNEL=telegram
   TELEGRAM_BOT_TOKEN=123:ABC...
   TELEGRAM_BOT_USERNAME=Aegis_verification_bot
   NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=Aegis_verification_bot
   ```
4. Restart `npm run dev`.

The flow uses Telegram `getUpdates` polling, no webhook URL needed.

### Telegram backups (recommended on free hosting)

Render's free tier wipes the filesystem on every redeploy. To survive
that, point the server at a private Telegram chat you control:

1. Create a new private group (or use Saved Messages with a fresh chat).
2. Add your `TELEGRAM_BOT_TOKEN` bot to the group as a member.
3. Send any message to the group so Telegram registers the chat.
4. Find the chat id (e.g. via `https://api.telegram.org/bot<TOKEN>/getUpdates`).
5. Set `AEGIS_BACKUP_CHAT_ID=<chat_id>` in your env.

The server uploads an encrypted snapshot every hour. On a cold start
with an empty database, the latest backup is automatically pulled and
restored. Backups are sealed with NoLook before they leave the server,
so the chat owner sees only ciphertext.

### OwlSight AI (Gemini)

The AI panel needs a Google AI Studio key:

1. Go to https://aistudio.google.com/app/apikey
2. Create a new API key (free tier — 60 req/min, no monthly cap).
3. Set `GEMINI_API_KEY=AIza...` in your env.

Without the key, EXIF + OCR still work — only the AI panel is greyed
out with an explanation.

### Switching to real SMS (Twilio)

```env
OTP_CHANNEL=sms
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
```

### Simulated mode (offline demos)

```env
OTP_CHANNEL=simulate
```

Codes are returned in the API response and shown in the UI.

---

## Security model

AEGIS layers defences in depth.

### Authentication
- **bcrypt** password hashing (configurable rounds, default 12).
- **JWT (HS256)** sessions stored in an `httpOnly`, `SameSite=Lax`,
  `Secure` (production) cookie.
- **OTP** is bcrypt-hashed at rest, expires after `OTP_TTL_SECONDS`,
  capped at 5 attempts per session.
- **Login enumeration** is mitigated: a dummy bcrypt compare runs on
  user miss to keep response timing similar.
- **UID recovery** never reveals whether a phone is registered: the
  API always issues a session id and silently no-ops the OTP delivery
  if no account matches.

### NoLook — at-rest encryption
- Authenticated **AES-256-GCM** with random 96-bit IV and per-record AAD.
- Master key derived once via **scrypt** from `NOLOOK_KEY`
  (or `JWT_SECRET` as a fallback).
- Backwards compatible: legacy plaintext rows continue to read normally.
- Encrypted fields:
  - **Dossiers** — `phone`, `email`, `address`, `social_media`,
    `known_accounts`, `notes`, `investigation_summary`,
    `activity_timeline`, `connections`, `additional_evidence`,
    `target_image`, `evidence_images`.
  - **AntChat** — message body, file payload, file name, dossier
    reference, dossier snapshot.
  - **Backups** — entire DB snapshot before upload to Telegram.
- Indexed/listed columns (`full_name`, `alias`, `country`, `city`,
  `tags`, `classification`, `status`, `risk_level`, timestamps) stay
  plaintext so search and filtering remain fast.
- Tampered ciphertext fails GCM verification and decrypt returns empty —
  no silent data corruption.

### Transport & access control
- Rate limiting on every sensitive endpoint (login, OTP, recovery,
  chat send, image analysis).
- Zod input validation on every handler.
- Ownership scoping: dossier reads/writes are restricted to
  `owner_id = current user`.
- Chat messages are always sent under the authenticated `senderId`;
  the server never trusts a client-supplied sender.
- OwlSight images are never persisted server-side; only the analysis
  result is returned in the response.
- Audit log is per-user and read-only — no edit / delete API.

### What NoLook does *not* protect against
- A full server compromise that leaks both the database **and** the
  environment containing `NOLOOK_KEY`. Use a separate `NOLOOK_KEY`
  (different from `JWT_SECRET`) and rotate them independently to raise
  the bar.
- Account takeover (an attacker logged in as a user can read their
  own encrypted records — this is by design).

> For real-world deployments, additionally enforce HTTPS, set strong
> independent values for `JWT_SECRET` and `NOLOOK_KEY`, configure a
> CDN/WAF, and review your threat model.

---

## API Reference

All routes return JSON. Authentication uses an httpOnly cookie named
`aegis_session` (SameSite=Lax, Secure in production).

### Authentication

| Method | Endpoint | Auth | Body / Query |
| --- | --- | --- | --- |
| POST | `/api/auth/register/start` | — | `{ phone }` |
| GET  | `/api/auth/register/telegram-status?token=` | — | — |
| POST | `/api/auth/register/telegram-send` | — | `{ linkToken }` |
| POST | `/api/auth/register/verify` | — | `{ sessionId, code }` |
| POST | `/api/auth/register/finalize` | — | `{ sessionId, password, displayName? }` |
| POST | `/api/auth/login` | — | `{ uid, password }` |
| POST | `/api/auth/logout` | ✅ | — |
| GET  | `/api/auth/me` | ✅ | — |
| GET  | `/api/auth/profile` | ✅ | — |
| PUT  | `/api/auth/profile` | ✅ | `{ displayName?, bio?, avatarUrl? }` |
| POST | `/api/auth/change-password` | ✅ | `{ currentPassword, newPassword }` |
| POST | `/api/auth/recover-uid/start` | — | `{ phone }` |
| POST | `/api/auth/recover-uid/reveal` | — | `{ sessionId, code }` |

### Dossiers

| Method | Endpoint | Body |
| --- | --- | --- |
| GET    | `/api/dossiers` | — |
| POST   | `/api/dossiers` | full dossier payload |
| GET    | `/api/dossiers/:id` | — |
| PUT    | `/api/dossiers/:id` | full dossier payload |
| DELETE | `/api/dossiers/:id` | — |

### Users

| Method | Endpoint | Query |
| --- | --- | --- |
| GET | `/api/users/search` | `?q=` (UID prefix or partial display name) |

### AntChat

| Method | Endpoint | Body |
| --- | --- | --- |
| GET  | `/api/chat/conversations` | — |
| GET  | `/api/chat/threads/:peerId` | — |
| POST | `/api/chat/messages` | `{ kind: "text", recipientId, text }` |
|      |                     | `{ kind: "file", recipientId, file: {...} }` |
|      |                     | `{ kind: "dossier", recipientId, dossierId }` |
| GET  | `/api/chat/stream` (SSE) | — |

### OwlSight

| Method | Endpoint | Body |
| --- | --- | --- |
| POST | `/api/intel/analyze` | `{ dataUrl, useAi }` |

### Backup (admin only)

| Method | Endpoint | Notes |
| --- | --- | --- |
| GET  | `/api/backup` | Status |
| POST | `/api/backup` | Force a snapshot now |
| POST | `/api/backup/restore` | Restore latest from Telegram |

### Audit

| Method | Endpoint | Query |
| --- | --- | --- |
| GET | `/api/audit` | `?before=<ts>&limit=<n>` |

---

## Folder Structure

```
.
├── data/                         # SQLite file (gitignored)
├── desktop/                      # Electron client
│   ├── main.js
│   ├── preload.js
│   ├── splash.html
│   └── electron-builder.yml
├── scripts/
│   └── init-db.mjs               # one-shot schema bootstrap
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── audit/
│   │   │   ├── auth/             # incl. profile, recover-uid, register
│   │   │   ├── backup/
│   │   │   ├── chat/             # conversations, messages, stream, threads
│   │   │   ├── dossiers/
│   │   │   ├── intel/            # OwlSight analyze
│   │   │   └── users/
│   │   ├── dashboard/
│   │   │   ├── sections/         # Database / Add / Find / Chat /
│   │   │   │                     # OwlSight (ImageIntel) / News /
│   │   │   │                     # Support / Profile / Activity
│   │   │   ├── modals/           # Change pw, dossier viewer, notifications
│   │   │   └── ChatFab.tsx
│   │   ├── login/
│   │   ├── register/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx              # redirects to /login or /dashboard
│   ├── components/
│   │   ├── i18n/                 # I18nProvider + LanguageSwitcher
│   │   ├── perf/                 # PerfProvider — adaptive performance
│   │   └── ui/                   # Logo, Toast, Boot, Strength, ...
│   ├── hooks/
│   │   ├── useChatStream.ts
│   │   └── useNotifications.ts
│   ├── lib/
│   │   ├── api.ts                # JSON helpers
│   │   ├── audit.ts              # audit log service
│   │   ├── auth.ts               # JWT + cookies + session
│   │   ├── backup.ts             # Telegram encrypted backup
│   │   ├── chat.ts               # AntChat data access
│   │   ├── chatBus.ts            # in-memory SSE pub/sub
│   │   ├── constants.ts          # edge-safe constants
│   │   ├── db.ts                 # SQLite singleton + schema
│   │   ├── dossier.ts            # data access (with NoLook)
│   │   ├── env.ts                # typed env access
│   │   ├── i18n/                 # uz / ru / en dictionaries
│   │   ├── ids.ts                # cuid + numeric UID generator
│   │   ├── imageIntel.ts         # OwlSight: EXIF + Gemini
│   │   ├── noLook.ts             # AES-256-GCM encryption layer
│   │   ├── otp.ts                # OTP service
│   │   ├── rate-limit.ts         # fixed-window limiter
│   │   ├── telegram.ts           # bot helpers
│   │   ├── utils.ts              # cn(), formatDate(), maskUid()
│   │   └── validation.ts         # Zod schemas
│   └── middleware.ts             # cookie gate for /dashboard
├── tailwind.config.ts
├── postcss.config.mjs
├── next.config.mjs
├── render.yaml                   # Render Blueprint
├── tsconfig.json
└── package.json
```

---

## Deployment

### Render (recommended for free tier)

A `render.yaml` blueprint is included. Push the repo to GitHub, click
**New → Blueprint** in Render and connect your repo. Render will read
the manifest and prompt you for the sensitive env values:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`
- `NEXT_PUBLIC_TELEGRAM_SUPPORT_BOT_USERNAME`
- `AEGIS_BACKUP_CHAT_ID` (recommended)
- `GEMINI_API_KEY` (optional, enables OwlSight AI)

Free tier note: SQLite lives on the container's ephemeral filesystem
and the instance spins down after ~15 minutes of inactivity. With
**Telegram backups** configured the dataset survives both. The first
request after a cold start may take 30–60 s while the container wakes
and (if needed) restores the latest snapshot.

### Vercel

Vercel's filesystem is also ephemeral. For Vercel you should swap to a
hosted Postgres (Neon, Supabase, Railway) and update `src/lib/db.ts`
to use it. The Telegram backup pipeline stays useful as a secondary
safety net.

### Self-hosted (Docker example)

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=base /app .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm","start"]
```

Mount `/app/data` to a persistent volume for the SQLite file.

---

## Desktop client (beta)

A native Electron shell lives in [`desktop/`](./desktop). It bundles
the AEGIS web experience inside a chrome-less window with a custom
splash screen, single-instance handling and a friendly offline page.

```bash
cd desktop
npm install
npm run build:win        # → dist/AEGIS-Setup-1.0.0-beta.1-x64.exe
npm run build:linux      # → AEGIS-…-x64.AppImage and aegis_…_amd64.deb
```

Cross-building targets needs the matching toolchain (Wine for Windows
installers from Linux, a Mac for `.dmg`); the simplest path is one
target per native OS. A GitHub Actions workflow at
`.github/workflows/desktop-release.yml` builds both targets on every
release tag and attaches them to the matching GitHub Release.

---

## Roadmap

- HawkEye OSINT module — Sherlock-powered username scan
- 2FA TOTP for login (Authenticator app)
- Group chats (AntSquad)
- Voice messages in AntChat
- Map view of dossiers worldwide
- Public profile pages

---

## License

Educational use only.
