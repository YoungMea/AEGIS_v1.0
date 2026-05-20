/**
 * POST /api/auth/change-password
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk, safeJson, fromZod } from "@/lib/api";
import { changePasswordSchema } from "@/lib/validation";
import { requireUser, hashPassword, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ZodError } from "zod";

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return jsonError("Unauthorized", 401);
  }

  const body = await safeJson(req);
  let parsed;
  try {
    parsed = changePasswordSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) return jsonError("Invalid input", 400, fromZod(e));
    return jsonError("Invalid input");
  }

  const db = getDb();
  const row = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(user.id) as { password_hash: string } | undefined;
  if (!row) return jsonError("User not found", 404);

  const ok = await verifyPassword(parsed.currentPassword, row.password_hash);
  if (!ok) return jsonError("Current password incorrect", 401);

  const newHash = await hashPassword(parsed.newPassword);
  db.prepare(
    "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
  ).run(newHash, Date.now(), user.id);

  return jsonOk({ ok: true });
}
