#!/usr/bin/env node
/**
 * Initializes the SQLite database file & schema.
 * Useful for first-time deploys: `npm run db:init`
 */
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

const url = process.env.DATABASE_URL ?? "./data/aegis.db";
const target = path.isAbsolute(url) ? url : path.join(process.cwd(), url);
fs.mkdirSync(path.dirname(target), { recursive: true });

const db = new Database(target);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    uid           TEXT UNIQUE NOT NULL,
    phone         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name  TEXT,
    bio           TEXT,
    avatar_url    TEXT,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    last_login_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_users_uid   ON users(uid);
  CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

  CREATE TABLE IF NOT EXISTS otp_sessions (
    id         TEXT PRIMARY KEY,
    phone      TEXT NOT NULL,
    code_hash  TEXT NOT NULL,
    attempts   INTEGER NOT NULL DEFAULT 0,
    verified   INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_sessions(phone);

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
    evidence_images       TEXT,
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
    bucket       TEXT NOT NULL,
    key          TEXT NOT NULL,
    count        INTEGER NOT NULL,
    window_start INTEGER NOT NULL,
    PRIMARY KEY (bucket, key)
  );

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
  CREATE INDEX IF NOT EXISTS idx_audit_user_time ON audit_log(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS chat_messages (
    id                TEXT PRIMARY KEY,
    conversation_key  TEXT NOT NULL,
    sender_id         TEXT NOT NULL,
    recipient_id      TEXT NOT NULL,
    kind              TEXT NOT NULL,
    body              TEXT,
    file_name         TEXT,
    file_mime         TEXT,
    file_size         INTEGER,
    file_data         TEXT,
    dossier_ref       TEXT,
    dossier_summary   TEXT,
    created_at        INTEGER NOT NULL,
    read_at           INTEGER,
    FOREIGN KEY (sender_id)    REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_chat_conv   ON chat_messages(conversation_key, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_chat_inbox  ON chat_messages(recipient_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_chat_outbox ON chat_messages(sender_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_chat_unread ON chat_messages(recipient_id, read_at);
`);

console.log(`✓ Database initialized at ${target}`);
db.close();
