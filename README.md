# AEGIS — Classified OSINT Intelligence Platform

A cinematic full-stack OSINT/intelligence dossier system built for educational use.
Looks and feels like a confidential agency console: dark tactical UI, secure
authentication, OTP enrollment, and a fully-featured investigation document
editor with realistic paper textures, classification stamps, and barcodes.

> ⚠️ **Educational only.** This is not a production intelligence tool. Use it
> to learn full-stack development, authentication flows, and design systems.

---

## Features

- 🔐 **JWT authentication** with bcrypt password hashing (cost factor 12 by default)
- 📱 **OTP enrollment** via Telegram bot (default), SMS, or simulated mode
- 🪪 **Numeric UID assignment** (8 digits) used as login identifier
- 🗂 **Dossier management** with classification, risk level, status, tags
- 🖋 **Realistic intelligence document editor** — paper textures, stamps, barcodes,
  scanning animation, image upload, timeline, connections, and more
- 👥 **Operative directory** — search other users by partial UID
- 🛡 **Hardened API** — rate limiting, Zod validation, ownership scoping, no user enumeration
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

1. Enter a phone number (format `+12025550123`)
2. Receive an OTP — in **simulate mode** the code is shown directly in the UI
   *and* logged to the server console
3. Set a strong password
4. The system assigns a unique 8-digit UID and signs you into the dashboard

To re-login later, use that UID + your password on the Login page.

---

## Configuration

All knobs live in `.env`. See `.env.example` for the full list.

| Variable | Default | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | dev-only fallback | Secret used to sign session JWTs |
| `JWT_EXPIRES_IN` | `7d` | Session lifetime |
| `DATABASE_URL` | `./data/aegis.db` | SQLite file path |
| `OTP_CHANNEL` | `telegram` | `telegram` · `sms` · `simulate` |
| `OTP_LENGTH` | `6` | Digits in the OTP code |
| `OTP_TTL_SECONDS` | `300` | OTP validity window |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost |
| `TELEGRAM_BOT_TOKEN` | — | Token from @BotFather |
| `TELEGRAM_BOT_USERNAME` | — | Bot username (no `@`) |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | — | Same value, exposed to the browser |
| `TWILIO_ACCOUNT_SID` | — | Required when `OTP_CHANNEL=sms` |
| `TWILIO_AUTH_TOKEN` | — | Required when `OTP_CHANNEL=sms` |
| `TWILIO_FROM_NUMBER` | — | Required when `OTP_CHANNEL=sms` |

### Telegram channel (recommended)

The default flow uses a Telegram bot to deliver OTPs. Steps:

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

User flow:
- The user enters their phone number on `/register`.
- Step "Telegram" shows an **Open verification bot** button. It opens
  `t.me/<bot>?start=<linkToken>`.
- Once the user taps **START** in Telegram, the registration page detects
  the bind (via short polling of `/api/auth/register/telegram-status`) and
  enables **Send code**.
- Tapping it pushes a 6-digit code into the user's bot DM. Verification
  continues normally.

How it works internally:
- `verification_links` table stores ephemeral `link_token → chat_id` pairs.
- `/api/auth/register/telegram-status` calls `getUpdates` on every poll and
  resolves any pending tokens whose `/start <token>` message has arrived.
- No webhook URL is required. The bot works fully through outbound calls,
  so the app runs on `localhost` with no public URL needed.

### Switching to real SMS (Twilio)

```env
OTP_CHANNEL=sms
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+15551234567
```

### Simulated mode (offline demos)

```env
OTP_CHANNEL=simulate
```

Codes are returned in the API response and shown in the UI.

---

## API Reference

All routes return JSON. Authentication uses an httpOnly cookie named
`aegis_session` (SameSite=Lax, Secure in production).

### Authentication

| Method | Endpoint | Auth | Body / Query |
| --- | --- | --- | --- |
| POST | `/api/auth/register/start` | — | `{ phone }` |
| POST | `/api/auth/register/verify` | — | `{ sessionId, code }` |
| POST | `/api/auth/register/finalize` | — | `{ sessionId, password, displayName? }` |
| POST | `/api/auth/login` | — | `{ uid, password }` |
| POST | `/api/auth/logout` | ✅ | — |
| GET  | `/api/auth/me` | ✅ | — |
| POST | `/api/auth/change-password` | ✅ | `{ currentPassword, newPassword }` |

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
| GET | `/api/users/search` | `?uid=NNN` (numeric prefix, ≥2 digits) |

---

## Folder Structure

```
.
├── data/                       # SQLite file (gitignored)
├── scripts/
│   └── init-db.mjs             # one-shot schema bootstrap
├── src/
│   ├── app/
│   │   ├── api/                # all route handlers
│   │   │   ├── auth/
│   │   │   ├── dossiers/
│   │   │   └── users/
│   │   ├── dashboard/          # authenticated console
│   │   │   ├── sections/       # Database / Add / Find Friends
│   │   │   └── modals/         # Change password, dossier viewer
│   │   ├── login/
│   │   ├── register/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx            # redirect root to /login or /dashboard
│   ├── components/
│   │   └── ui/                 # Logo, Toast, Boot, Strength, ...
│   ├── lib/
│   │   ├── api.ts              # JSON helpers
│   │   ├── auth.ts             # JWT + cookies + session
│   │   ├── db.ts               # SQLite singleton + schema
│   │   ├── dossier.ts          # data access for dossiers
│   │   ├── env.ts              # typed env access
│   │   ├── ids.ts              # cuid + numeric UID generator
│   │   ├── otp.ts              # OTP service
│   │   ├── rate-limit.ts       # fixed-window limiter
│   │   ├── utils.ts            # cn(), formatDate(), maskUid()
│   │   └── validation.ts       # Zod schemas
│   └── middleware.ts           # cookie gate for /dashboard
├── tailwind.config.ts
├── postcss.config.mjs
├── next.config.mjs
├── tsconfig.json
└── package.json
```

---

## Security Notes

- **Password hashing** — bcrypt with configurable rounds; default 12.
- **Session JWT** — signed with HS256, stored in `httpOnly`, `SameSite=Lax`,
  `Secure` (production) cookie. Lifetime configurable.
- **Login enumeration** — `/api/auth/login` runs a dummy bcrypt compare on miss
  to keep response timing similar.
- **Rate limiting** — fixed-window limiter keyed by IP and identifier on
  sensitive endpoints (login, OTP start/verify).
- **OTP storage** — codes are bcrypt-hashed, expire after `OTP_TTL_SECONDS`,
  capped at 5 attempts per session.
- **Input validation** — Zod on every handler; flattened errors returned.
- **Ownership** — dossier reads/writes are scoped to `owner_id = current user`.
- **CSRF** — `SameSite=Lax` cookie + JSON-only routes; no third-party form posts
  are exposed.
- **XSS** — React auto-escapes; user-controlled HTML is never rendered as raw.

> For real-world deployments, additionally enforce HTTPS, set a strong
> `JWT_SECRET`, configure a CDN/WAF, and review your threat model.

---

## Deployment

### Vercel

1. Push the repo to GitHub.
2. Import into Vercel.
3. Set environment variables (at minimum `JWT_SECRET`).
4. **Important:** Vercel's filesystem is ephemeral. SQLite is fine for demos
   but use a managed Postgres (Neon, Supabase, Railway) in production. Swap the
   driver in `src/lib/db.ts` accordingly.

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

## Roadmap Ideas

- File attachments (S3-compatible store)
- Map view of dossier locations
- Encrypted-at-rest dossier blobs (`crypto.subtle` per-user keys)
- Admin role + audit log
- Real PDF rendering (puppeteer or pdfkit)
- WebSocket presence indicators

---

## License

Educational use only.
