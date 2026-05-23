/**
 * POST /api/auth/logout
 */
import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/api";
import { clearSessionCookie, getSessionUser } from "@/lib/auth";
import { record } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (user) {
    record({
      userId: user.id,
      action: "auth.logout",
      summary: `UID ${user.uid}`,
      ip: clientIp(req),
    });
  }
  await clearSessionCookie();
  return jsonOk({ ok: true });
}
