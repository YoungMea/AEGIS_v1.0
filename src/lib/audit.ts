/**
 * Audit log service.
 *
 * `record()` is invoked from API handlers to log a user-facing action. The
 * UI then exposes them in My Activity as a chronological feed.
 *
 * We only log the bare minimum that helps a user audit their own session:
 *   action  — well-known token (e.g. "dossier.created")
 *   target  — type + id of the object touched (dossier, message, …)
 *   summary — short human-readable preview shown in the feed
 *   detail  — small JSON payload for debugging / future filters
 *
 * Anything sensitive (encrypted dossier fields, message bodies) is *not*
 * stored here — only references that the owner can look up.
 */
import { getDb } from "./db";
import { cuid } from "./ids";

export type AuditAction =
  | "auth.login"
  | "auth.logout"
  | "auth.password_changed"
  | "auth.profile_updated"
  | "dossier.created"
  | "dossier.updated"
  | "dossier.viewed"
  | "dossier.deleted"
  | "chat.sent";

export interface AuditEntry {
  id: string;
  userId: string;
  action: AuditAction;
  targetType: string | null;
  targetId: string | null;
  summary: string | null;
  detail: Record<string, unknown> | null;
  ip: string | null;
  createdAt: number;
}

interface RecordInput {
  userId: string;
  action: AuditAction;
  targetType?: string | null;
  targetId?: string | null;
  summary?: string | null;
  detail?: Record<string, unknown> | null;
  ip?: string | null;
}

export function record(input: RecordInput): void {
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO audit_log
        (id, user_id, action, target_type, target_id, summary, detail, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      cuid(),
      input.userId,
      input.action,
      input.targetType ?? null,
      input.targetId ?? null,
      input.summary ?? null,
      input.detail ? JSON.stringify(input.detail) : null,
      input.ip ?? null,
      Date.now(),
    );
  } catch (e) {
    // Never let logging break the request flow.
    // eslint-disable-next-line no-console
    console.warn("[audit] write failed:", (e as Error).message);
  }
}

export function listForUser(
  userId: string,
  opts: { before?: number; limit?: number } = {},
): AuditEntry[] {
  const db = getDb();
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const before = opts.before ?? Date.now() + 1;
  const rows = db
    .prepare(
      `SELECT id, user_id, action, target_type, target_id, summary, detail, ip, created_at
         FROM audit_log
        WHERE user_id = ? AND created_at < ?
        ORDER BY created_at DESC
        LIMIT ?`,
    )
    .all(userId, before, limit) as Array<{
    id: string;
    user_id: string;
    action: AuditAction;
    target_type: string | null;
    target_id: string | null;
    summary: string | null;
    detail: string | null;
    ip: string | null;
    created_at: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    summary: r.summary,
    detail: r.detail ? safeParse(r.detail) : null,
    ip: r.ip,
    createdAt: r.created_at,
  }));
}

function safeParse(s: string): Record<string, unknown> | null {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return null;
  }
}
