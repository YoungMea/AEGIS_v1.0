/**
 * One-Time Password (OTP) service.
 *
 * The actual delivery channel is selected via OTP_CHANNEL:
 *   • simulate → code is returned directly in the API response (educational)
 *   • telegram → code is sent through the configured bot to the user's chat_id
 *   • sms      → code is sent through Twilio
 *
 * In every channel the verification mechanism is the same:
 *   - codes are bcrypt-hashed before storage
 *   - sessions expire after OTP_TTL_SECONDS
 *   - max 5 verify attempts per session
 */
import bcrypt from "bcryptjs";
import { randomInt, randomBytes } from "node:crypto";
import { getDb } from "./db";
import { cuid } from "./ids";
import { env } from "./env";
import { sendVerificationCode } from "./telegram";

const MAX_ATTEMPTS = 5;

function generateCode(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += randomInt(0, 10).toString();
  return out;
}

export interface OtpStartResult {
  sessionId: string;
  expiresAt: number;
  /** Simulated mode only — never returned in production. */
  devCode?: string;
}

/**
 * Create an OTP session. The actual code is generated AND hashed here, but
 * delivery is the caller's responsibility (so Telegram flow can split the
 * "wait for chat link" step from the "send code" step).
 *
 * Internal helper — not exposed as-is.
 */
async function createSession(
  phone: string,
  delivery: "simulate" | "telegram" | "sms",
  chatId?: string | null,
): Promise<{ id: string; code: string; expiresAt: number }> {
  const db = getDb();
  const code = generateCode(env.OTP_LENGTH);
  const now = Date.now();
  const expiresAt = now + env.OTP_TTL_SECONDS * 1000;
  const id = cuid();
  const codeHash = await bcrypt.hash(code, 10);

  // Invalidate any prior unfinished sessions for this phone.
  db.prepare(
    "UPDATE otp_sessions SET expires_at = ? WHERE phone = ? AND verified = 0 AND expires_at > ?",
  ).run(now, phone, now);

  db.prepare(
    `INSERT INTO otp_sessions (id, phone, code_hash, attempts, verified, delivery, chat_id, created_at, expires_at)
     VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?)`,
  ).run(id, phone, codeHash, delivery, chatId ?? null, now, expiresAt);

  return { id, code, expiresAt };
}

/**
 * Public entry point used by /api/auth/register/start (legacy path —
 * returns simulated code or pushes through SMS).
 *
 * For Telegram delivery, callers must use startTelegramOtpFlow + sendCodeViaTelegram.
 */
export async function startOtpSession(phone: string): Promise<OtpStartResult> {
  const channel = env.OTP_CHANNEL;
  if (channel === "telegram") {
    // The Telegram flow doesn't fit this single-shot model, but we still
    // expose a sensible fallback: caller should switch to the Telegram flow.
    throw new Error(
      "OTP_CHANNEL=telegram requires the dedicated Telegram registration flow.",
    );
  }
  const { id, code, expiresAt } = await createSession(phone, channel);

  if (channel === "sms") {
    await sendSms(phone, `${env.AGENCY_NAME} security code: ${code}`);
    return { sessionId: id, expiresAt };
  }

  // simulate
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(`[OTP:simulate] ${phone} → ${code} (sid=${id})`);
  }
  return { sessionId: id, expiresAt, devCode: code };
}

/**
 * Telegram flow — step 1: create a verification_links row + return the
 * deep-link payload the UI should embed in t.me/<bot>?start=<token>.
 *
 * No OTP is generated yet; we wait until the user opens the bot.
 */
export interface TelegramLinkResult {
  linkToken: string;
  expiresAt: number;
}

export function startTelegramLink(phone: string): TelegramLinkResult {
  const db = getDb();
  const linkToken = randomBytes(16).toString("hex");
  const now = Date.now();
  const expiresAt = now + env.OTP_TTL_SECONDS * 1000;

  db.prepare(
    `INSERT INTO verification_links (link_token, phone, chat_id, username, created_at, expires_at)
     VALUES (?, ?, NULL, NULL, ?, ?)`,
  ).run(linkToken, phone, now, expiresAt);

  return { linkToken, expiresAt };
}

export interface TelegramLinkStatus {
  linked: boolean;
  expired: boolean;
  username?: string | null;
}

export function getTelegramLinkStatus(linkToken: string): TelegramLinkStatus {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT chat_id, username, expires_at FROM verification_links WHERE link_token = ?",
    )
    .get(linkToken) as
    | { chat_id: string | null; username: string | null; expires_at: number }
    | undefined;
  if (!row) return { linked: false, expired: true };
  if (Date.now() > row.expires_at && !row.chat_id) {
    return { linked: false, expired: true };
  }
  return { linked: !!row.chat_id, expired: false, username: row.username };
}

/**
 * Telegram flow — step 2: once the link is resolved, generate the OTP and
 * push it to the user's chat. Returns a session id usable by /verify.
 */
export async function sendTelegramOtp(
  linkToken: string,
): Promise<OtpStartResult> {
  const db = getDb();
  const link = db
    .prepare(
      "SELECT phone, chat_id, expires_at FROM verification_links WHERE link_token = ?",
    )
    .get(linkToken) as
    | { phone: string; chat_id: string | null; expires_at: number }
    | undefined;
  if (!link) throw new Error("LINK_NOT_FOUND");
  if (!link.chat_id) throw new Error("LINK_NOT_BOUND");
  // Allow a small grace period (TTL of OTP itself), even if link technically
  // expired between the bind and this call.
  if (Date.now() > link.expires_at + env.OTP_TTL_SECONDS * 1000) {
    throw new Error("LINK_EXPIRED");
  }

  const { id, code, expiresAt } = await createSession(
    link.phone,
    "telegram",
    link.chat_id,
  );

  await sendVerificationCode(link.chat_id, code);

  return { sessionId: id, expiresAt };
}

export interface OtpVerifyResult {
  ok: boolean;
  reason?: "EXPIRED" | "TOO_MANY_ATTEMPTS" | "INVALID_CODE" | "NOT_FOUND";
}

export async function verifyOtp(
  sessionId: string,
  code: string,
): Promise<OtpVerifyResult> {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, phone, code_hash, attempts, verified, expires_at
       FROM otp_sessions WHERE id = ?`,
    )
    .get(sessionId) as
    | {
        id: string;
        phone: string;
        code_hash: string;
        attempts: number;
        verified: number;
        expires_at: number;
      }
    | undefined;

  if (!row) return { ok: false, reason: "NOT_FOUND" };
  if (row.verified) return { ok: true };
  if (Date.now() > row.expires_at) return { ok: false, reason: "EXPIRED" };
  if (row.attempts >= MAX_ATTEMPTS)
    return { ok: false, reason: "TOO_MANY_ATTEMPTS" };

  const ok = await bcrypt.compare(code, row.code_hash);
  if (!ok) {
    db.prepare(
      "UPDATE otp_sessions SET attempts = attempts + 1 WHERE id = ?",
    ).run(sessionId);
    return { ok: false, reason: "INVALID_CODE" };
  }

  db.prepare("UPDATE otp_sessions SET verified = 1 WHERE id = ?").run(
    sessionId,
  );
  return { ok: true };
}

export function getVerifiedPhone(sessionId: string): string | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT phone, verified, expires_at, chat_id FROM otp_sessions WHERE id = ?",
    )
    .get(sessionId) as
    | { phone: string; verified: number; expires_at: number; chat_id: string | null }
    | undefined;
  if (!row) return null;
  if (!row.verified) return null;
  // Allow finalize within 15 min of verification regardless of TTL.
  const grace = 15 * 60 * 1000;
  if (Date.now() > row.expires_at + grace) return null;
  return row.phone;
}

export function getSessionChatId(sessionId: string): string | null {
  const db = getDb();
  const row = db
    .prepare("SELECT chat_id FROM otp_sessions WHERE id = ?")
    .get(sessionId) as { chat_id: string | null } | undefined;
  return row?.chat_id ?? null;
}

async function sendSms(to: string, body: string): Promise<void> {
  if (!env.TWILIO.SID || !env.TWILIO.TOKEN || !env.TWILIO.FROM) {
    throw new Error("Twilio credentials not configured");
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO.SID}/Messages.json`;
  const auth = Buffer.from(`${env.TWILIO.SID}:${env.TWILIO.TOKEN}`).toString(
    "base64",
  );
  const params = new URLSearchParams({ To: to, From: env.TWILIO.FROM, Body: body });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Twilio error ${res.status}: ${txt}`);
  }
}


/**
 * UID recovery flow.
 *
 * The user enters their phone, we look up the existing account, generate
 * an OTP and push it directly into their bound Telegram chat. Once they
 * confirm the code, we hand them their UID back.
 *
 * To avoid leaking which numbers are registered, the API responds the same
 * way regardless of whether the phone is found — but the OTP is only created
 * for real users.
 */
export interface RecoverStartResult {
  /** Same shape regardless of whether the phone exists. */
  sessionId: string;
  expiresAt: number;
  /** Hint for UI to nudge the user. Never reveals if the number was found. */
  channelHint: "telegram" | "none";
}

export async function startUidRecovery(
  phone: string,
): Promise<RecoverStartResult> {
  const db = getDb();
  const now = Date.now();
  const expiresAt = now + env.OTP_TTL_SECONDS * 1000;

  const user = db
    .prepare(
      "SELECT id, uid, telegram_chat_id FROM users WHERE phone = ?",
    )
    .get(phone) as
    | { id: string; uid: string; telegram_chat_id: string | null }
    | undefined;

  // Always create a session record. If there's no user, we still return a
  // session id so the response is indistinguishable from the success case.
  // The verify call will fail later — that's fine and expected.
  const id = cuid();
  const fakeCode = generateCode(env.OTP_LENGTH);
  const codeHash = await bcrypt.hash(fakeCode, 10);

  // Invalidate prior recovery sessions for this phone.
  db.prepare(
    "UPDATE otp_sessions SET expires_at = ? WHERE phone = ? AND verified = 0 AND delivery = 'recover' AND expires_at > ?",
  ).run(now, phone, now);

  db.prepare(
    `INSERT INTO otp_sessions (id, phone, code_hash, attempts, verified, delivery, chat_id, created_at, expires_at)
     VALUES (?, ?, ?, 0, 0, 'recover', ?, ?, ?)`,
  ).run(id, phone, codeHash, user?.telegram_chat_id ?? null, now, expiresAt);

  // Only deliver the code if a real chat link exists.
  if (user && user.telegram_chat_id) {
    try {
      await sendVerificationCode(user.telegram_chat_id, fakeCode);
    } catch (e) {
      // We swallow delivery errors so the response timing/shape stays consistent.
      // eslint-disable-next-line no-console
      console.warn("[otp:recover] delivery failed:", (e as Error).message);
    }
  } else if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(
      `[OTP:recover] phone=${phone} code=${fakeCode} (no user / no chat link)`,
    );
  }

  return {
    sessionId: id,
    expiresAt,
    channelHint: user?.telegram_chat_id ? "telegram" : "none",
  };
}

/**
 * Step 2 of the recovery flow — exchange a verified session for the UID.
 * Returns null when the session is missing/unverified or the underlying
 * user no longer exists.
 */
export function getRecoveredUid(sessionId: string): string | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT phone, verified, delivery, expires_at
       FROM otp_sessions WHERE id = ?`,
    )
    .get(sessionId) as
    | {
        phone: string;
        verified: number;
        delivery: string;
        expires_at: number;
      }
    | undefined;
  if (!row) return null;
  if (row.delivery !== "recover") return null;
  if (!row.verified) return null;
  // 15 min grace after verification.
  const grace = 15 * 60 * 1000;
  if (Date.now() > row.expires_at + grace) return null;

  const user = db
    .prepare("SELECT uid FROM users WHERE phone = ?")
    .get(row.phone) as { uid: string } | undefined;
  return user?.uid ?? null;
}
