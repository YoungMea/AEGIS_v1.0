/**
 * POST /api/auth/login
 * Authenticate by UID + password.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk, safeJson, fromZod } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { getDb } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import {
  signSession,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { record } from "@/lib/audit";
import { ZodError } from "zod";

export async function POST(req: NextRequest) {
  const body = await safeJson(req);
  let parsed;
  try {
    parsed = loginSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) return jsonError("Invalid input", 400, fromZod(e));
    return jsonError("Invalid input");
  }

  const ip = clientIp(req);
  const limit = rateLimit({
    bucket: "login:ip",
    key: ip,
    limit: 20,
    windowSec: 300,
  });
  if (!limit.allowed) return jsonError("Too many attempts", 429);
  const userLimit = rateLimit({
    bucket: "login:uid",
    key: parsed.uid,
    limit: 8,
    windowSec: 300,
  });
  if (!userLimit.allowed) return jsonError("Account temporarily locked", 429);

  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, uid, phone, password_hash, display_name FROM users WHERE uid = ?",
    )
    .get(parsed.uid) as
    | {
        id: string;
        uid: string;
        phone: string;
        password_hash: string;
        display_name: string | null;
      }
    | undefined;

  // Always run a verify even on miss to prevent user enumeration via timing.
  const ok = row
    ? await verifyPassword(parsed.password, row.password_hash)
    : await verifyPassword(parsed.password, "$2a$10$invalidsaltinvalidsaltinvalidsaltinvalidsaltinvali");

  if (!row || !ok) return jsonError("Invalid credentials", 401);

  db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(
    Date.now(),
    row.id,
  );

  const token = signSession({ sub: row.id, uid: row.uid });
  await setSessionCookie(token);

  record({
    userId: row.id,
    action: "auth.login",
    summary: `UID ${row.uid}`,
    ip,
  });

  return jsonOk({
    user: {
      id: row.id,
      uid: row.uid,
      phone: row.phone,
      displayName: row.display_name,
    },
  });
}
