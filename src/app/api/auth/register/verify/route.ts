/**
 * POST /api/auth/register/verify
 * Validate the OTP code for a session.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk, safeJson, fromZod } from "@/lib/api";
import { otpVerifySchema } from "@/lib/validation";
import { verifyOtp } from "@/lib/otp";
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

  const ip = clientIp(req);
  const limit = rateLimit({
    bucket: "otp:verify:ip",
    key: ip,
    limit: 30,
    windowSec: 600,
  });
  if (!limit.allowed) return jsonError("Too many attempts", 429);

  const result = await verifyOtp(parsed.sessionId, parsed.code);
  if (!result.ok) {
    const map: Record<string, [string, number]> = {
      EXPIRED: ["Code expired. Request a new one.", 410],
      TOO_MANY_ATTEMPTS: ["Too many attempts. Restart verification.", 429],
      INVALID_CODE: ["Invalid code", 401],
      NOT_FOUND: ["Session not found", 404],
    };
    const [msg, status] = map[result.reason ?? "INVALID_CODE"]!;
    return jsonError(msg, status);
  }
  return jsonOk({ verified: true });
}
