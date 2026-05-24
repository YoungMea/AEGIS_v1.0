/**
 * POST /api/backup/restore
 * Pulls the latest backup from the admin Telegram chat and overwrites
 * the local database. Restricted to the admin operative.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { restoreLatest } from "@/lib/backup";
import { getDb } from "@/lib/db";

function isAdmin(uid: string): boolean {
  const explicit = (process.env.AEGIS_ADMIN_UID ?? "").trim();
  if (explicit) return uid === explicit;
  const db = getDb();
  const row = db
    .prepare("SELECT uid FROM users ORDER BY created_at ASC LIMIT 1")
    .get() as { uid: string } | undefined;
  return !!row && row.uid === uid;
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return jsonError("Unauthorized", 401);
  }
  if (!isAdmin(user.uid)) return jsonError("Forbidden", 403);

  const result = await restoreLatest();
  if (!result.ok) return jsonError(result.error ?? "Restore failed", 500);
  return jsonOk({ ok: true, bytes: result.bytes });
}
