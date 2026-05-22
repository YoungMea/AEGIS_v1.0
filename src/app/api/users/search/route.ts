/**
 * GET /api/users/search?q=...
 *
 * Look up an operative by partial UID OR partial display name.
 * The active user is excluded from results so chat targets only show others.
 *
 * Backwards compatible: ?uid= still works.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return jsonError("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const raw = (url.searchParams.get("q") ?? url.searchParams.get("uid") ?? "")
    .trim();
  if (raw.length === 0) return jsonOk({ results: [] });
  if (raw.length > 80) return jsonOk({ results: [] });

  const db = getDb();
  let rows: Array<{
    id: string;
    uid: string;
    display_name: string | null;
    avatar_url: string | null;
    created_at: number;
  }> = [];

  if (/^[0-9]{2,12}$/.test(raw)) {
    // Pure numeric query → UID prefix lookup (back-compat with old behaviour).
    rows = db
      .prepare(
        `SELECT id, uid, display_name, avatar_url, created_at
           FROM users
          WHERE uid LIKE ? AND id != ?
          ORDER BY uid ASC
          LIMIT 12`,
      )
      .all(`${raw}%`, user.id) as typeof rows;
  } else {
    // Otherwise try matching either uid or display_name (case-insensitive).
    const like = `%${raw}%`;
    rows = db
      .prepare(
        `SELECT id, uid, display_name, avatar_url, created_at
           FROM users
          WHERE id != ?
            AND (uid LIKE ? OR LOWER(display_name) LIKE LOWER(?))
          ORDER BY
            CASE WHEN LOWER(display_name) LIKE LOWER(?) THEN 0 ELSE 1 END,
            display_name ASC, uid ASC
          LIMIT 12`,
      )
      .all(user.id, like, like, `${raw}%`) as typeof rows;
  }

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
