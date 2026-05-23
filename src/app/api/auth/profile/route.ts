/**
 * GET  /api/auth/profile  — current user's profile
 * PUT  /api/auth/profile  — update display name, bio, avatar
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk, safeJson, fromZod } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { updateProfileSchema } from "@/lib/validation";
import { getDb } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { record } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { ZodError } from "zod";

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return jsonError("Unauthorized", 401);
  }
  return jsonOk({
    profile: {
      id: user.id,
      uid: user.uid,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      createdAt: user.created_at,
    },
  });
}

export async function PUT(req: NextRequest) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return jsonError("Unauthorized", 401);
  }

  // Avatar payloads can be ~600 KB, so guard against rapid-fire updates.
  if (
    !rateLimit({
      bucket: "profile:update:user",
      key: user.id,
      limit: 30,
      windowSec: 60,
    }).allowed
  ) {
    return jsonError("Slow down", 429);
  }

  const body = await safeJson(req);
  let parsed;
  try {
    parsed = updateProfileSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) return jsonError("Invalid input", 400, fromZod(e));
    return jsonError("Invalid input");
  }

  // Light guard: if avatarUrl looks like a data URL, ensure it's an image
  // type. Anything else is rejected so we don't accidentally store
  // arbitrary base64 blobs.
  if (parsed.avatarUrl && parsed.avatarUrl.startsWith("data:")) {
    if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(parsed.avatarUrl)) {
      return jsonError("Avatar must be an image", 400);
    }
  }

  const db = getDb();
  db.prepare(
    `UPDATE users
        SET display_name = ?, bio = ?, avatar_url = ?, updated_at = ?
      WHERE id = ?`,
  ).run(
    parsed.displayName,
    parsed.bio,
    parsed.avatarUrl,
    Date.now(),
    user.id,
  );

  record({
    userId: user.id,
    action: "auth.profile_updated",
    summary: parsed.displayName ?? null,
    ip: clientIp(req),
  });

  return jsonOk({
    profile: {
      id: user.id,
      uid: user.uid,
      displayName: parsed.displayName,
      avatarUrl: parsed.avatarUrl,
      bio: parsed.bio,
      createdAt: user.created_at,
    },
  });
}
