/**
 * POST /api/auth/recover-uid/reveal
 *
 * Step 2 of the "Forgot UID" flow. Verifies the OTP code against the
 * recovery session and returns the user's UID.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk, safeJson, fromZod } from "@/lib/api";
import { otpVerifySchema } from "@/lib/validation";
import { getRecoveredUid, verifyOtp } from "@/lib/otp";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { ZodError } from "zod";

export async function POST(req: NextRequest) {
  const body = await safeJson(req);
  let parsed;
  try {
    parsed = otpVerifySchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) return jsonError("Invalid input", 400, fromZod(e));
    return jsonError("Invalid input");
  }

  if (
    !rateLimit({
      bucket: "recover:reveal:ip",
      key: clientIp(req),
      limit: 30,
      windowSec: 600,
    }).allowed
  ) {
    return jsonError("Too many attempts", 429);
  }

  const result = await verifyOtp(parsed.sessionId, parsed.code);
  if (!result.ok) {
    const map: Record<string, [string, number]> = {
      EXPIRED: ["Code expired. Request a new one.", 410],
      TOO_MANY_ATTEMPTS: ["Too many attempts. Restart recovery.", 429],
      INVALID_CODE: ["Invalid code", 401],
      NOT_FOUND: ["Session not found", 404],
    };
    const [msg, status] = map[result.reason ?? "INVALID_CODE"]!;
    return jsonError(msg, status);
  }

  const uid = getRecoveredUid(parsed.sessionId);
  if (!uid) {
    // Phone wasn't actually registered — same status as a wrong code so
    // we don't leak account existence.
    return jsonError("Invalid code", 401);
  }
  return jsonOk({ uid });
}
