/**
 * POST /api/auth/register/finalize
 * Complete registration: create user, generate UID, sign session.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk, safeJson, fromZod } from "@/lib/api";
import { finalizeRegistrationSchema } from "@/lib/validation";
import { getSessionChatId, getVerifiedPhone } from "@/lib/otp";
import { getDb } from "@/lib/db";
import { cuid, generateUID } from "@/lib/ids";
import {
  hashPassword,
  signSession,
  setSessionCookie,
} from "@/lib/auth";
import { ZodError } from "zod";

const MAX_UID_TRIES = 8;

export async function POST(req: NextRequest) {
  const body = await safeJson(req);
  let parsed;
  try {
    parsed = finalizeRegistrationSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) return jsonError("Invalid input", 400, fromZod(e));
    return jsonError("Invalid input");
  }

  const phone = getVerifiedPhone(parsed.sessionId);
  if (!phone)
    return jsonError("Verification session expired or invalid", 401);

  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM users WHERE phone = ?")
    .get(phone);
  if (existing) return jsonError("Phone already registered", 409);

  const passwordHash = await hashPassword(parsed.password);
  const id = cuid();
  const now = Date.now();

  let uid = "";
  for (let i = 0; i < MAX_UID_TRIES; i++) {
    const candidate = generateUID();
    const taken = db.prepare("SELECT id FROM users WHERE uid = ?").get(candidate);
    if (!taken) {
      uid = candidate;
      break;
    }
  }
  if (!uid) return jsonError("Could not allocate UID, please retry", 500);

  // If the OTP was delivered via Telegram, persist the chat link with the
  // newly created user so we can push future notifications to them.
  const chatId = getSessionChatId(parsed.sessionId);

  db.prepare(
    `INSERT INTO users (id, uid, phone, password_hash, display_name, avatar_url, telegram_chat_id, telegram_username, created_at, updated_at, last_login_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?)`,
  ).run(
    id,
    uid,
    phone,
    passwordHash,
    parsed.displayName ?? null,
    chatId,
    now,
    now,
    now,
  );

  // Invalidate session so it can't be reused.
  db.prepare(
    "UPDATE otp_sessions SET expires_at = ? WHERE id = ?",
  ).run(0, parsed.sessionId);

  const token = signSession({ sub: id, uid });
  await setSessionCookie(token);

  return jsonOk({
    user: {
      id,
      uid,
      phone,
      displayName: parsed.displayName ?? null,
    },
  });
}
