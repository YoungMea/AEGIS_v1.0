/**
 * POST /api/intel/analyze
 *
 * Body: { dataUrl: string, useAi: boolean }
 *
 * Always reads EXIF from the uploaded image. Optionally pings Gemini for
 * the AI scene/geo guess — that step needs GEMINI_API_KEY and counts
 * against the free quota, so the client decides whether to spend it.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk, safeJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import {
  aiVision,
  aiProviderLabel,
  isAiConfigured,
  readExif,
} from "@/lib/imageIntel";
import { z } from "zod";

const schema = z.object({
  // Hard-cap a single payload at ~7 MB base64 to keep the Gemini call snappy.
  dataUrl: z.string().regex(/^data:image\//).max(10_000_000),
  useAi: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return jsonError("Unauthorized", 401);
  }

  // 30 analyses/min per user is plenty even when the analyst is power-using.
  if (
    !rateLimit({
      bucket: "intel:analyze:user",
      key: user.id,
      limit: 30,
      windowSec: 60,
    }).allowed
  ) {
    return jsonError("Slow down", 429);
  }
  // Coarse IP guard for unauthenticated abuse — even though we require auth.
  rateLimit({
    bucket: "intel:analyze:ip",
    key: clientIp(req),
    limit: 120,
    windowSec: 60,
  });

  const body = await safeJson(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input", 400);

  const exif = await readExif(parsed.data.dataUrl);
  let ai = null;
  let aiSkippedReason: string | null = null;

  if (parsed.data.useAi) {
    if (!isAiConfigured()) {
      aiSkippedReason = "GEMINI_API_KEY missing";
    } else {
      ai = await aiVision(parsed.data.dataUrl);
      if (!ai) aiSkippedReason = "AI provider returned no result";
    }
  }

  return jsonOk({
    exif,
    ai,
    aiSkippedReason,
    aiAvailable: isAiConfigured(),
    aiProvider: aiProviderLabel(),
  });
}
