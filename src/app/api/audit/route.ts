/**
 * GET /api/audit?before=<ts>&limit=<n>
 *
 * Paginated audit feed for the active user. `before` is the createdAt
 * cursor of the oldest entry already shown — anything strictly older is
 * returned. The first request omits `before`, subsequent "load older"
 * requests pass the createdAt of the last item.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listForUser } from "@/lib/audit";

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return jsonError("Unauthorized", 401);
  }
  const url = new URL(req.url);
  const before = url.searchParams.get("before");
  const limit = url.searchParams.get("limit");
  const entries = listForUser(user.id, {
    before: before ? Number(before) : undefined,
    limit: limit ? Number(limit) : 50,
  });
  return jsonOk({ entries });
}
