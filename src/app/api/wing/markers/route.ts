/**
 * GET /api/wing/markers
 *
 * Returns geocoded markers for the active operative's dossiers. The
 * geocode step is throttled (1.1s/request to Nominatim) the first time
 * each location is seen; subsequent calls hit the cache and are instant.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { buildMarkers } from "@/lib/wing";

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return jsonError("Unauthorized", 401);
  }

  // 12 calls/min/user is plenty even with rapid manual refreshes.
  if (
    !rateLimit({
      bucket: "wing:markers:user",
      key: user.id,
      limit: 12,
      windowSec: 60,
    }).allowed
  ) {
    return jsonError("Slow down", 429);
  }

  const markers = await buildMarkers(user.id);
  return jsonOk({ markers });
}
