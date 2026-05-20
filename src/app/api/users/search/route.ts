/**
 * GET /api/users/search?uid=NNNN
 * Find a user by full or partial UID. Auth required.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    await requireUser(req);
  } catch {
    return jsonError("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("uid") ?? "").trim();
  if (!/^[0-9]{2,12}$/.test(q))
    return jsonOk({ results: [] });

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, uid, display_name, avatar_url, created_at
       FROM users
       WHERE uid LIKE ?
       ORDER BY uid ASC
       LIMIT 12`,
    )
    .all(`${q}%`) as {
    id: string;
    uid: string;
    display_name: string | null;
    avatar_url: string | null;
    created_at: number;
  }[];

  return jsonOk({
    results: rows.map((r) => ({
      id: r.id,
      uid: r.uid,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      createdAt: r.created_at,
    })),
  });
}
