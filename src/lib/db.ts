/**
 * SQLite database singleton.
 *
 * SQLite is used for zero-config educational deployment. The schema is
 * production-shaped and can be migrated to PostgreSQL by swapping the driver
 * (column types are intentionally compatible).
 */
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { env } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __aegisDb: Database.Database | undefined;
}

function resolveDbPath(): string {
  const p = env.DATABASE_URL;
  return path.isAbsolute(p) ? p : path.join(process.cwd(), p);
}

function ensureDir(p: string) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Idempotent migration. Each migration is wrapped in a try/catch so we can
 * safely add columns to existing databases.
 */
function migrate(db: Database.Database) {
  const safeAlter = (sql: string) => {
    try {
      db.exec(sql);
    } catch (e) {
      const msg = (e as Error).message;
      // Ignore "duplicate column" errors when re-running migrations
      if (!/duplicate column|already exists/i.test(msg)) {
        // eslint-disable-next-line no-console
        console.warn("[db migrate]", msg);
      }
    }
  };

  safeAlter("ALTER TABLE otp_sessions ADD COLUMN delivery TEXT NOT NULL DEFAULT 'simulate'");
  safeAlter("ALTER TABLE otp_sessions ADD COLUMN chat_id TEXT");
  safeAlter("ALTER TABLE users ADD COLUMN telegram_chat_id TEXT");
  safeAlter("ALTER TABLE users ADD COLUMN telegram_username TEXT");
  safeAlter("ALTER TABLE users ADD COLUMN bio TEXT");
  safeAlter("ALTER TABLE dossiers ADD COLUMN evidence_images TEXT");
}

function init(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id                TEXT PRIMARY KEY,
      uid               TEXT UNIQUE NOT NULL,
      phone             TEXT UNIQUE NOT NULL,
      password_hash     TEXT NOT NULL,
      display_name      TEXT,
      bio               TEXT,
      avatar_url        TEXT,
      telegram_chat_id  TEXT,
      telegram_username TEXT,
      created_at        INTEGER NOT NULL,
      updated_at        INTEGER NOT NULL,
      last_login_at     INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_users_uid   ON users(uid);
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

    CREATE TABLE IF NOT EXISTS otp_sessions (
      id            TEXT PRIMARY KEY,
      phone         TEXT NOT NULL,
      code_hash     TEXT NOT NULL,
      attempts      INTEGER NOT NULL DEFAULT 0,
      verified      INTEGER NOT NULL DEFAULT 0,
      delivery      TEXT NOT NULL DEFAULT 'simulate',
      chat_id       TEXT,
      created_at    INTEGER NOT NULL,
      expires_at    INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_sessions(phone);

    -- Ephemeral tokens used to bind a Telegram chat to an OTP session.
    -- Lifecycle:
    --   1. UI creates a verification_links row with a random "link_token"
    --   2. UI shows the user a deep-link: t.me/<bot>?start=<link_token>
    --   3. Telegram bot, on receiving "/start <link_token>", calls our
    --      webhook/poll handler which stores the user's chat_id on the row.
    --   4. UI polls /api/auth/register/telegram-status until chat_id appears.
    --   5. UI calls /api/auth/register/telegram-send to actually deliver
    --      the OTP into that chat_id.
    CREATE TABLE IF NOT EXISTS verification_links (
      link_token  TEXT PRIMARY KEY,
      phone       TEXT NOT NULL,
      chat_id     TEXT,
      username    TEXT,
      created_at  INTEGER NOT NULL,
      expires_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vlinks_expires ON verification_links(expires_at);

    -- Cursor for the Telegram getUpdates long-poll loop.
    CREATE TABLE IF NOT EXISTS kv_store (
      k TEXT PRIMARY KEY,
      v TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dossiers (
      id                    TEXT PRIMARY KEY,
      owner_id              TEXT NOT NULL,
      classification        TEXT NOT NULL DEFAULT 'CONFIDENTIAL',
      status                TEXT NOT NULL DEFAULT 'ACTIVE',
      target_image          TEXT,
      full_name             TEXT,
      alias                 TEXT,
      phone                 TEXT,
      email                 TEXT,
      country               TEXT,
      city                  TEXT,
      address               TEXT,
      social_media          TEXT,
      known_accounts        TEXT,
      notes                 TEXT,
      investigation_summary TEXT,
      activity_timeline     TEXT,
      connections           TEXT,
      additional_evidence   TEXT,
      evidence_images       TEXT, -- encrypted JSON array of base64 data URLs
      risk_level            TEXT NOT NULL DEFAULT 'LOW',
      tags                  TEXT,
      created_at            INTEGER NOT NULL,
      updated_at            INTEGER NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_dossiers_owner   ON dossiers(owner_id);
    CREATE INDEX IF NOT EXISTS idx_dossiers_status  ON dossiers(status);
    CREATE INDEX IF NOT EXISTS idx_dossiers_updated ON dossiers(updated_at DESC);

    CREATE TABLE IF NOT EXISTS rate_limits (
      bucket      TEXT NOT NULL,
      key         TEXT NOT NULL,
      count       INTEGER NOT NULL,
      window_start INTEGER NOT NULL,
      PRIMARY KEY (bucket, key)
    );

    -- Geocode cache: maps "<city>, <country>" → lat/lng so we never hit
    -- Nominatim more than once per location. The cache is shared across
    -- users — coordinates of public places are not sensitive, and this
    -- keeps the Wing map snappy even on free hosting.
    CREATE TABLE IF NOT EXISTS geocode_cache (
      query        TEXT PRIMARY KEY,  -- normalised lowercase "city, country"
      lat          REAL,
      lng          REAL,
      display_name TEXT,
      hit_at       INTEGER NOT NULL,
      created_at   INTEGER NOT NULL
    );

    -- Audit trail: every meaningful operative action gets a row so the user
    -- can see "what did I touch" inside My Activity. Detail is a small JSON
    -- blob with action-specific extras (e.g. dossier id, peer uid).
    CREATE TABLE IF NOT EXISTS audit_log (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      action      TEXT NOT NULL,
      target_type TEXT,
      target_id   TEXT,
      summary     TEXT,
      detail      TEXT,
      ip          TEXT,
      created_at  INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_audit_user_time
      ON audit_log(user_id, created_at DESC);

    -- AntChat: every message is a row. Conversations are derived by ordering
    -- (sender_id, recipient_id) into a deterministic conversation_key so a
    -- single composite index can serve both inbox + thread views.
    CREATE TABLE IF NOT EXISTS chat_messages (
      id                TEXT PRIMARY KEY,
      conversation_key  TEXT NOT NULL,   -- min(uidA, uidB) || ':' || max(uidA, uidB)
      sender_id         TEXT NOT NULL,
      recipient_id      TEXT NOT NULL,
      kind              TEXT NOT NULL,   -- 'text' | 'file' | 'dossier'
      body              TEXT,            -- encrypted with NoLook (ciphertext or null for non-text kinds)
      file_name         TEXT,            -- encrypted
      file_mime         TEXT,            -- plaintext, generic mime
      file_size         INTEGER,         -- plaintext, in bytes
      file_data         TEXT,            -- encrypted base64 payload (capped to 2 MB)
      dossier_ref       TEXT,            -- encrypted, dossier id snapshot
      dossier_summary   TEXT,            -- encrypted JSON snapshot for read-only viewing
      created_at        INTEGER NOT NULL,
      read_at           INTEGER,
      FOREIGN KEY (sender_id)    REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_chat_conv     ON chat_messages(conversation_key, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_chat_inbox    ON chat_messages(recipient_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_chat_outbox   ON chat_messages(sender_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_chat_unread   ON chat_messages(recipient_id, read_at);
  `);

  // For older databases — bring missing columns in.
  migrate(db);
}

export function getDb(): Database.Database {
  if (globalThis.__aegisDb) return globalThis.__aegisDb;
  const file = resolveDbPath();
  ensureDir(file);
  const db = new Database(file);
  init(db);
  globalThis.__aegisDb = db;

  // Kick off the Telegram backup loop. The first cold start will also
  // attempt a restore if the DB looks empty. Both are best-effort and
  // never block the request handling.
  void (async () => {
    try {
      const mod = await import("./backup");
      await mod.ensureRecovered();
      mod.startScheduler();
    } catch {
      /* backup is optional */
    }
  })();

  return globalThis.__aegisDb;
}
