# AEGIS — Classified OSINT Intelligence Platform

A cinematic full-stack OSINT/intelligence dossier system built for educational
use. Looks and feels like a confidential agency console: dark tactical UI,
secure authentication, OTP enrollment, encrypted dossiers, and a built-in
operative-to-operative chat channel.

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
- 🪪 **Numeric UID assignment** (8 digits) used as login identifier
- 🗂 **Dossier management** with classification, risk level, status, tags
- 🖋 **Realistic intelligence document editor** — paper textures, stamps,
  barcodes, scanning animation, image upload, timeline, connections, more
- 💬 **AntChat** — encrypted operative-to-operative messaging (text, files
  up to 2 MB, dossier snapshots)
- 👥 **Operative directory** — search by partial UID *or* codename
- 📰 **In-app news bulletin** with cinematic SVG covers
- 🎧 **Support** — Telegram-based help channel
- 🌐 **Trilingual** — UZ / RU / EN, accessible without login
- 🛡 **Hardened API** — rate limiting, Zod validation, ownership scoping,
  no user enumeration on auth endpoints
- 🌗 **Dark cinematic UI** — Tailwind, Framer Motion, Lucide icons, custom fonts
- 📱 **Fully responsive** — mobile, tablet, desktop, ultrawide
- 🖨 **Print/Export PDF** via the browser print pipeline

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
| Validation | Zod |

The schema is intentionally flat so it can be migrated to PostgreSQL or MongoDB
by swapping the driver in `src/lib/db.ts`.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env and adjust values
cp .env.example .env
# then edit .env (at minimum, set JWT_SECRET to a long random string)

# 3. Initialize the SQLite database (optional — auto-runs on first request)
npm run db:init

# 4. Start the dev server
npm run dev
```

Open http://localhost:3000

You will land on the **Login** screen. Click **Request enrollment** to:

1. Enter a phone number (format `+998901234567`)
2. Open the verification bot once via the deep-link button
3. Receive a 6-digit code in Telegram
4. Set a strong password
5. The system assigns a unique 8-digit UID and signs you into the dashboard

To re-login later, use that UID + your password on the Login page.
Forgot the UID? Tap **Forgot UID?** on login and recover it by phone.

---

## Modules

### My Database
Browse, filter and manage your classified dossiers as folders. Status, risk
level and tag filters keep large archives organized.

### Add Information
A full-screen investigation document editor: image upload, sections for
identity, geolocation, digital footprint, timeline, connections, evidence
and tags. Save, archive, print or export to PDF. **Sensitive fields are
encrypted on disk via NoLook.**

### Find Friends
Look up other operatives by partial UID *or* codename. Click any result to
jump straight into AntChat with that operative.

### AntChat
Encrypted messaging. Three message kinds:
- **Text** (up to 4 000 characters)
- **File** — pictures, PDFs, evidence up to **2 MB**, stored encrypted
- **Dossier** — read-only snapshot of any of your dossiers

Every body, attachment and snapshot is encrypted with NoLook before it
touches disk. Conversations are sorted by latest activity and show unread
counters.

### News
In-app bulletin with announcements, capability releases and module previews.
Each story has a tactical SVG cover and a long-form modal with highlights.

### Support
Reach the team via the configured Telegram support bot, or paste a quick
message into the form — the message is copied to clipboard so you can
forward it inside Telegram.

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

---

## Security model

AEGIS layers defences in depth.

### Authentication
- **bcrypt** password hashing (configurable rounds, default 12).
- **JWT (HS256)** sessions stored in an `httpOnly`, `SameSite=Lax`, `Secure`
  (production) cookie.
- **OTP** is bcrypt-hashed at rest, expires after `OTP_TTL_SECONDS`, capped
  at 5 attempts per session.
- **Login enumeration** is mitigated: a dummy bcrypt compare runs on user
  miss to keep response timing similar.
- **UID recovery** never reveals whether a phone is registered: the API
  always issues a session id and silently no-ops the OTP delivery if no
  account matches.

### NoLook — at-rest encryption
- Authenticated **AES-256-GCM** with random 96-bit IV and per-record AAD.
- Master key derived once via **scrypt** from `NOLOOK_KEY`
  (or `JWT_SECRET` as a fallback).
- Backwards compatible: legacy plaintext rows continue to read normally.
- Encrypted fields:
  - **Dossiers** — `phone`, `email`, `address`, `social_media`,
    `known_accounts`, `notes`, `investigation_summary`,
    `activity_timeline`, `connections`, `additional_evidence`,
    `target_image`.
  - **AntChat** — message body, file payload, file name, dossier reference,
    dossier snapshot.
- Indexed/listed columns (`full_name`, `alias`, `country`, `city`, `tags`,
  `classification`, `status`, `risk_level`, timestamps) stay plaintext so
  search and filtering remain fast.
- Tampered ciphertext fails GCM verification and decrypt returns empty —
  no silent data corruption.

### Transport & access control
- Rate limiting on every sensitive endpoint (login, OTP, recovery, chat send).
- Zod input validation on every handler.
- Ownership scoping: dossier reads/writes are restricted to
  `owner_id = current user`.
- Chat messages are always sent under the authenticated `senderId`; the
  server never trusts a client-supplied sender.

### What NoLook does *not* protect against
- A full server compromise that leaks both the database **and** the
  environment containing `NOLOOK_KEY`. Use a separate `NOLOOK_KEY`
  (different from `JWT_SECRET`) and rotate them independently to raise
  the bar.
- Account takeover (an attacker logged in as a user can read their own
  encrypted records — this is by design).

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
| POST | `/api/auth/register/telegram-status?token=` | — | — |
| POST | `/api/auth/register/telegram-send` | — | `{ linkToken }` |
| POST | `/api/auth/register/verify` | — | `{ sessionId, code }` |
| POST | `/api/auth/register/finalize` | — | `{ sessionId, password, displayName? }` |
| POST | `/api/auth/login` | — | `{ uid, password }` |
| POST | `/api/auth/logout` | ✅ | — |
| GET  | `/api/auth/me` | ✅ | — |
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

---

## Folder Structure

```
.
├── data/                       # SQLite file (gitignored)
├── scripts/
│   └── init-db.mjs             # one-shot schema bootstrap
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── chat/
│   │   │   ├── dossiers/
│   │   │   └── users/
│   │   ├── dashboard/
│   │   │   ├── sections/       # Database / Add / Find / Chat / News / Support
│   │   │   └── modals/         # Change password, dossier viewer
│   │   ├── login/
│   │   ├── register/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx            # redirect root to /login or /dashboard
│   ├── components/
│   │   ├── i18n/               # I18nProvider + LanguageSwitcher
│   │   └── ui/                 # Logo, Toast, Boot, Strength, ...
│   ├── lib/
│   │   ├── api.ts              # JSON helpers
│   │   ├── auth.ts             # JWT + cookies + session
│   │   ├── chat.ts             # AntChat data access
│   │   ├── constants.ts        # edge-safe constants
│   │   ├── db.ts               # SQLite singleton + schema
│   │   ├── dossier.ts          # data access (with NoLook)
│   │   ├── env.ts              # typed env access
│   │   ├── i18n/               # uz / ru / en dictionaries
│   │   ├── ids.ts              # cuid + numeric UID generator
│   │   ├── noLook.ts           # AES-256-GCM encryption layer
│   │   ├── otp.ts              # OTP service
│   │   ├── rate-limit.ts       # fixed-window limiter
│   │   ├── telegram.ts         # bot helpers
│   │   ├── utils.ts            # cn(), formatDate(), maskUid()
│   │   └── validation.ts       # Zod schemas
│   └── middleware.ts           # cookie gate for /dashboard
├── tailwind.config.ts
├── postcss.config.mjs
├── next.config.mjs
├── render.yaml                 # Render Blueprint for one-click deploy
├── tsconfig.json
└── package.json
```

---

## Deployment

### Render (recommended for free tier)

A `render.yaml` blueprint is included. Push the repo to GitHub, click
**New → Blueprint** in Render and connect your repo. Render will read the
manifest and prompt you for the four sensitive env values:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`
- `NEXT_PUBLIC_TELEGRAM_SUPPORT_BOT_USERNAME`

Free tier note: SQLite lives on the container's ephemeral filesystem and
the instance spins down after ~15 minutes of inactivity, so data is
reset between cold starts. For real users, upgrade the plan and attach a
persistent disk (the relevant block is commented in `render.yaml`).

### Vercel

Vercel's filesystem is also ephemeral. Move the database to a hosted
Postgres (Neon, Supabase, Railway) and swap the driver in `src/lib/db.ts`
to keep data across deploys.

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

A native Electron shell lives in [`desktop/`](./desktop). It bundles the
AEGIS web experience inside a chrome-less window with a custom splash
screen, single-instance handling and a friendly offline page.

```bash
cd desktop
npm install
npm run build:win        # → dist/AEGIS-Setup-1.0.0-beta.1-x64.exe
npm run build:linux      # → AEGIS-…-x64.AppImage and aegis_…_amd64.deb
```

Cross-building targets needs the matching toolchain (Wine for Windows
installers from Linux, a Mac for `.dmg`); the simplest path is one target
per native OS.

---

## Roadmap

- HawkEye OSINT module (Sherlock-powered username scan)- Map view of dossier locations
- Per-user encryption keys (key escrow / recovery)
- Real PDF rendering (puppeteer / pdfkit)
- WebSocket presence and typing indicators in AntChat

---

## License

Educational use only.
