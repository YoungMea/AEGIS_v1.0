/**
 * POST /api/eagleeye/scan
 * Body: { mode: "username" | "email" | "phone", q: string }
 *
 * Runs the full EagleEye pipeline (HawkEye fan-out + Wayback archive +
 * Instagram metadata + Gemini summary) in one server round-trip and
 * returns the full report.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk, safeJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  normaliseEmail,
  normalisePhone,
  normaliseUsername,
} from "@/lib/hawkEye";
import { runEagleEye, type EagleEyeMode } from "@/lib/eagleEye";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Allow EagleEye to run beyond the default 10s — the AI summary alone
// can take 20–40s on the OpenRouter free tier.
export const maxDuration = 60;

interface Body {
  mode?: string;
  q?: string;
  skipAi?: boolean;
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return jsonError("Unauthorized", 401);
  }

  const body = (await safeJson<Body>(req)) ?? {};
  const mode: EagleEyeMode =
    body.mode === "email"
      ? "email"
      : body.mode === "phone"
        ? "phone"
        : "username";
  const raw = (body.q ?? "").trim();

  const query =
    mode === "email"
      ? normaliseEmail(raw)
      : mode === "phone"
        ? normalisePhone(raw)
        : normaliseUsername(raw);

  if (!query) {
    return jsonError("Invalid query", 400);
  }

  // EagleEye is heavier than a HawkEye scan (Wayback + IG fetch + AI), so
  // we cap it tighter — 4/min is enough for analyst-driven use.
  if (
    !rateLimit({
      bucket: "hawkeye:scan:user",
      key: user.id,
      limit: 4,
      windowSec: 60,
    }).allowed
  ) {
    return jsonError("Slow down", 429);
  }

  const report = await runEagleEye({
    mode,
    query,
    skipAi: !!body.skipAi,
  });

  return jsonOk({ report });
}
