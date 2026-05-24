/**
 * AEGIS Telegram backup service.
 *
 * Render's free tier filesystem is ephemeral — every redeploy or container
 * recycle wipes data/aegis.db. To survive that, we periodically dump the
 * live database, encrypt it with NoLook and ship the bytes to a Telegram
 * chat (our own admin chat, not a user's). On boot, if the local DB looks
 * empty (no users), we ask Telegram for the latest backup and restore it.
 *
 * Lifecycle:
 *   - Boot: ensureRecovered() — runs once. If the DB is fresh, it pulls
 *     the most recent backup from the admin chat and replaces the local
 *     file before the app touches it.
 *   - Runtime: schedulerTick() — fires every 60 minutes.
 *   - Manual: makeBackupNow() / restoreFromUpdate() — used by /api/backup.
 */
import fs from "node:fs";
import path from "node:path";
import { env } from "./env";
import { encryptString, decryptString } from "./noLook";

const TG_API = "https://api.telegram.org";

interface TgFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

interface TgDocument {
  document?: {
    file_name?: string;
    mime_type?: string;
    file_id: string;
    file_size?: number;
  };
  caption?: string;
  date: number;
  message_id: number;
}

interface TgUpdate {
  update_id: number;
  channel_post?: TgDocument;
  message?: TgDocument & { chat: { id: number } };
}

function adminChatId(): string {
  return process.env.AEGIS_BACKUP_CHAT_ID ?? "";
}

function botToken(): string {
  return env.TELEGRAM_BOT_TOKEN;
}

function dbPath(): string {
  const p = env.DATABASE_URL;
  return path.isAbsolute(p) ? p : path.join(process.cwd(), p);
}

export function isBackupConfigured(): boolean {
  return botToken().length > 0 && adminChatId().length > 0;
}

/**
 * Wrap binary data in a JSON envelope, encrypt with NoLook, then upload
 * to the admin chat as a Telegram document. The file name embeds the
 * timestamp so listings can be sorted client-side.
 */
export async function makeBackupNow(): Promise<{
  ok: boolean;
  size?: number;
  error?: string;
}> {
  if (!isBackupConfigured()) {
    return { ok: false, error: "Backup not configured" };
  }
  try {
    const file = dbPath();
    if (!fs.existsSync(file)) {
      return { ok: false, error: "DB file missing" };
    }
    // Force a checkpoint so WAL/-shm contents are merged before reading.
    try {
      const { getDb } = await import("./db");
      getDb().pragma("wal_checkpoint(TRUNCATE)");
    } catch {
      /* ignore — checkpoint best-effort */
    }
    const raw = fs.readFileSync(file);
    const payload = JSON.stringify({
      v: 1,
      ts: Date.now(),
      bytes: raw.toString("base64"),
    });
    const ciphertext = encryptString(payload, "aegis-backup");

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `aegis-${stamp}.bak`;

    const form = new FormData();
    form.append("chat_id", adminChatId());
    form.append("caption", `🛡 AEGIS backup · ${stamp}`);
    form.append(
      "document",
      new Blob([ciphertext], { type: "application/octet-stream" }),
      fileName,
    );

    const res = await fetch(
      `${TG_API}/bot${botToken()}/sendDocument`,
      { method: "POST", body: form },
    );
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, error: `Telegram ${res.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true, size: ciphertext.length };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Walk recent updates the bot has received (in this case the admin chat
 * messages bouncing back to us), find the most recent backup attachment,
 * and download it.
 *
 * We use getUpdates rather than maintaining our own message archive — a
 * simple compromise that works for one admin chat and avoids a second
 * polling worker.
 */
async function findLatestBackupDocument(): Promise<TgFile | null> {
  try {
    const res = await fetch(
      `${TG_API}/bot${botToken()}/getUpdates?limit=100&timeout=0`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { ok: boolean; result: TgUpdate[] };
    if (!json.ok) return null;

    let latest: { update_id: number; doc: TgFile } | null = null;
    for (const u of json.result) {
      const msg = u.message ?? u.channel_post;
      if (!msg?.document) continue;
      if (!msg.document.file_name?.endsWith(".bak")) continue;
      if (!latest || u.update_id > latest.update_id) {
        latest = {
          update_id: u.update_id,
          doc: {
            file_id: msg.document.file_id,
            file_unique_id: msg.document.file_id,
            file_size: msg.document.file_size,
          },
        };
      }
    }
    return latest?.doc ?? null;
  } catch {
    return null;
  }
}

async function downloadFile(fileId: string): Promise<Buffer | null> {
  try {
    const r1 = await fetch(`${TG_API}/bot${botToken()}/getFile?file_id=${fileId}`);
    if (!r1.ok) return null;
    const j = (await r1.json()) as {
      ok: boolean;
      result: { file_path?: string };
    };
    if (!j.ok || !j.result.file_path) return null;
    const r2 = await fetch(
      `${TG_API}/file/bot${botToken()}/${j.result.file_path}`,
    );
    if (!r2.ok) return null;
    const ab = await r2.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

/**
 * Pull the latest backup from Telegram and overwrite the local DB.
 * Returns false if no backup was found or the file couldn't be decrypted.
 */
export async function restoreLatest(): Promise<{
  ok: boolean;
  error?: string;
  bytes?: number;
}> {
  if (!isBackupConfigured()) return { ok: false, error: "Not configured" };
  const doc = await findLatestBackupDocument();
  if (!doc) return { ok: false, error: "No backup found in chat" };
  const raw = await downloadFile(doc.file_id);
  if (!raw) return { ok: false, error: "Could not download backup" };

  const cipher = raw.toString("utf8");
  const plain = decryptString(cipher, "aegis-backup");
  if (!plain) return { ok: false, error: "Decryption failed" };

  let parsed: { v: number; ts: number; bytes: string };
  try {
    parsed = JSON.parse(plain);
  } catch {
    return { ok: false, error: "Malformed backup envelope" };
  }
  if (parsed.v !== 1 || typeof parsed.bytes !== "string") {
    return { ok: false, error: "Unsupported backup version" };
  }

  const dbBytes = Buffer.from(parsed.bytes, "base64");
  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, dbBytes);
  // Wipe stale WAL/SHM so SQLite reads the fresh main file.
  for (const ext of [".wal", ".shm", "-journal"]) {
    const p = file + ext;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  return { ok: true, bytes: dbBytes.length };
}

/**
 * Boot recovery: only restores if the local DB looks empty (no users).
 * Idempotent — safe to call on every cold start.
 *
 * NOTE: this runs *after* getDb() has initialised the schema, so the
 * `users` table is guaranteed to exist. The check therefore looks for
 * a populated table, not a populated file.
 */
let recoverPromise: Promise<void> | null = null;
export function ensureRecovered(): Promise<void> {
  if (recoverPromise) return recoverPromise;
  recoverPromise = (async () => {
    if (!isBackupConfigured()) return;
    try {
      const { getDb } = await import("./db");
      const db = getDb();
      let userCount = 0;
      try {
        const row = db.prepare("SELECT COUNT(*) AS c FROM users").get() as
          | { c: number }
          | undefined;
        userCount = row?.c ?? 0;
      } catch {
        userCount = 0;
      }
      if (userCount > 0) return; // local DB has data; skip restore.

      // eslint-disable-next-line no-console
      console.log("[backup] empty DB detected — restoring from Telegram…");

      // Close the open handle so we can safely overwrite the file.
      try {
        db.close();
      } catch {
        /* ignore */
      }
      // Forget the cached singleton so the next getDb() reopens the
      // freshly-restored file.
      try {
        (globalThis as unknown as { __aegisDb?: unknown }).__aegisDb = undefined;
      } catch {
        /* ignore */
      }

      const result = await restoreLatest();
      if (result.ok) {
        // eslint-disable-next-line no-console
        console.log(
          `[backup] restored ${result.bytes ?? 0} bytes from Telegram.`,
        );
      } else {
        // eslint-disable-next-line no-console
        console.warn(`[backup] restore skipped: ${result.error}`);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[backup] recovery failed:", (e as Error).message);
    }
  })();
  return recoverPromise;
}

/**
 * Hourly scheduler. Run-on-start optional — we usually wait one full
 * interval before the first upload.
 */
let schedulerStarted = false;
export function startScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  if (!isBackupConfigured()) return;
  const intervalMs = parseInt(
    process.env.AEGIS_BACKUP_INTERVAL_MS ?? `${60 * 60 * 1000}`,
    10,
  );
  setInterval(() => {
    void makeBackupNow().then((r) => {
      if (!r.ok) {
        // eslint-disable-next-line no-console
        console.warn("[backup] scheduled upload failed:", r.error);
      }
    });
  }, intervalMs);
}
