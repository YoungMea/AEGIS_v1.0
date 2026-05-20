/**
 * POST /api/auth/register/start
 *
 * Begin registration. Branches on OTP_CHANNEL:
 *  - simulate / sms → creates an OTP session and (optionally) sends SMS.
 *      Response: { sessionId, expiresAt, devCode? }
 *
 *  - telegram        → creates a verification_links row and returns a deep-link
 *      to the bot. The OTP itself is sent later by /telegram-send.
 *      Response: { mode: "telegram", linkToken, botUsername, deepLink, expiresAt }
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk, safeJson, fromZod } from "@/lib/api";
import { otpStartSchema } from "@/lib/validation";
import { startOtpSession, startTelegramLink } from "@/lib/otp";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { buildBotDeepLink } from "@/lib/telegram";
import { ZodError } from "zod";

export async function POST(req: NextRequest) {
  const body = await safeJson(req);
  let parsed;
  try {
    parsed = otpStartSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) return jsonError("Invalid input", 400, fromZod(e));
    return jsonError("Invalid input");
  }

  const ip = clientIp(req);
  const ipLimit = rateLimit({
    bucket: "otp:start:ip",
    key: ip,
    limit: 10,
    windowSec: 600,
  });
  if (!ipLimit.allowed) return jsonError("Too many requests", 429);

  const phoneLimit = rateLimit({
    bucket: "otp:start:phone",
    key: parsed.phone,
    limit: 5,
    windowSec: 600,
  });
  if (!phoneLimit.allowed)
    return jsonError("Please wait before requesting another code", 429);

  const db = getDb();
  const exists = db
    .prepare("SELECT id FROM users WHERE phone = ?")
    .get(parsed.phone);
  if (exists)
    return jsonError("This phone number is already registered", 409);

  // ---------- Telegram flow ----------
  if (env.OTP_CHANNEL === "telegram") {
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_BOT_USERNAME) {
      return jsonError(
        "Telegram bot is not configured on the server",
        500,
      );
    }
    const link = startTelegramLink(parsed.phone);
    return jsonOk({
      mode: "telegram",
      linkToken: link.linkToken,
      botUsername: env.TELEGRAM_BOT_USERNAME,
      deepLink: buildBotDeepLink(link.linkToken),
      expiresAt: link.expiresAt,
    });
  }

  // ---------- Legacy flows: simulate / sms ----------
  const result = await startOtpSession(parsed.phone);

  return jsonOk({
    mode: env.OTP_CHANNEL,
    sessionId: result.sessionId,
    expiresAt: result.expiresAt,
    devCode: env.OTP_CHANNEL === "simulate" ? result.devCode : undefined,
  });
}
