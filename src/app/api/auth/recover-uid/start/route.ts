/**
 * POST /api/auth/recover-uid/start
 *
 * Step 1 of the "Forgot UID" flow. The user submits the phone number they
 * enrolled with. If we find a matching account *and* it has a Telegram chat
 * link, we deliver the OTP there. Otherwise we still return a session id so
 * that an attacker cannot probe which phone numbers are registered.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk, safeJson, fromZod } from "@/lib/api";
import { otpStartSchema } from "@/lib/validation";
import { startUidRecovery } from "@/lib/otp";
import { rateLimit, clientIp } from "@/lib/rate-limit";
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
  if (!rateLimit({ bucket: "recover:ip", key: ip, limit: 10, windowSec: 600 }).allowed) {
    return jsonError("Too many requests", 429);
  }
  if (
    !rateLimit({
      bucket: "recover:phone",
      key: parsed.phone,
      limit: 5,
      windowSec: 600,
    }).allowed
  ) {
    return jsonError("Please wait before requesting another code", 429);
  }

  const result = await startUidRecovery(parsed.phone);
  return jsonOk({
    sessionId: result.sessionId,
    expiresAt: result.expiresAt,
    channelHint: result.channelHint,
  });
}
