/**
 * POST /api/auth/register/telegram-send
 *
 * After the chat has been linked, the UI calls this to actually deliver the
 * OTP into the user's Telegram DM. Returns an OTP sessionId for /verify.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk, safeJson } from "@/lib/api";
import { sendTelegramOtp } from "@/lib/otp";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({
  linkToken: z.string().regex(/^[a-f0-9]{16,64}$/i),
});

export async function POST(req: NextRequest) {
  const body = await safeJson(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input", 400);

  const limit = rateLimit({
    bucket: "tg:send:ip",
    key: clientIp(req),
    limit: 10,
    windowSec: 600,
  });
  if (!limit.allowed) return jsonError("Too many requests", 429);

  try {
    const result = await sendTelegramOtp(parsed.data.linkToken);
    return jsonOk({
      mode: "telegram",
      sessionId: result.sessionId,
      expiresAt: result.expiresAt,
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "LINK_NOT_FOUND")
      return jsonError("Verification session not found", 404);
    if (msg === "LINK_NOT_BOUND")
      return jsonError("Open the Telegram bot first", 409);
    if (msg === "LINK_EXPIRED")
      return jsonError("Verification link expired", 410);
    // eslint-disable-next-line no-console
    console.error("[tg:send]", msg);
    return jsonError("Could not deliver code via Telegram", 502);
  }
}
