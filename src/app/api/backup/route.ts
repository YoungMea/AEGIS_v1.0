/**
 * GET  /api/backup        — status (configured, last attempt)
 * POST /api/backup        — manual snapshot now
 * POST /api/backup/restore — pull the latest from Telegram
 *
 * Restricted to the admin user (matched by AEGIS_ADMIN_UID env var).
 * Defaults to the first registered user when AEGIS_ADMIN_UID is empty
 * — that's typically the operator who deployed the app.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  isBackupConfigured,
  makeBackupNow,
  restoreLatest,
} from "@/lib/backup";
import { getDb } from "@/lib/db";

function isAdmin(uid: string): boolean {
  const explicit = (process.env.AEGIS_ADMIN_UID ?? "").trim();
  if (explicit) return uid === explicit;
  // Fallback: lowest user.id is the founder. Looking up by created_at ASC
  // because UIDs are random.
  const db = getDb();
  const row = db
    .prepare("SELECT uid FROM users ORDER BY created_at ASC LIMIT 1")
    .get() as { uid: string } | undefined;
  return !!row && row.uid === uid;
}

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return jsonError("Unauthorized", 401);
  }
  if (!isAdmin(user.uid)) return jsonError("Forbidden", 403);
  return jsonOk({
    configured: isBackupConfigured(),
  });
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return jsonError("Unauthorized", 401);
  }
  if (!isAdmin(user.uid)) return jsonError("Forbidden", 403);
  const result = await makeBackupNow();
  if (!result.ok)
    return jsonError(result.error ?? "Backup failed", 500);
  return jsonOk({ ok: true, size: result.size });
}
