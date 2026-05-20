/**
 * GET /api/auth/register/telegram-status?token=<linkToken>
 *
 * Polled by the registration UI while the user is opening the Telegram bot.
 * Drains pending updates from Telegram and reports whether the link has
 * been bound to a chat yet.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { getTelegramLinkStatus } from "@/lib/otp";
import { drainUpdates } from "@/lib/telegram";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  if (!/^[a-f0-9]{16,64}$/i.test(token))
    return jsonError("Invalid token", 400);

  // Heavy polling guard: 60/min per IP is plenty for a 1-2s poll loop.
  const limit = rateLimit({
    bucket: "tg:status:ip",
    key: clientIp(req),
    limit: 60,
    windowSec: 60,
  });
  if (!limit.allowed) return jsonError("Too many requests", 429);

  // Pull recent bot updates so /start <token> messages get processed.
  try {
    await drainUpdates();
  } catch (e) {
    // Don't fail the polling cycle on transient Telegram errors.
    // eslint-disable-next-line no-console
    console.warn("[tg:drain]", (e as Error).message);
  }

  const status = getTelegramLinkStatus(token);
  if (status.expired) {
    return jsonError("Verification link expired", 410);
  }
  return jsonOk({
    linked: status.linked,
    username: status.username ?? null,
  });
}
