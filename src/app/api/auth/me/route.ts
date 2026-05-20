/**
 * GET /api/auth/me
 * Return the active session user.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return jsonError("Unauthorized", 401);
  return jsonOk({
    user: {
      id: user.id,
      uid: user.uid,
      phone: user.phone,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at,
    },
  });
}
