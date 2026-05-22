/**
 * GET /api/chat/threads/:peerId         — list messages with peer
 * POST /api/chat/threads/:peerId/read   — mark thread as read
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getThread, markThreadRead } from "@/lib/chat";
import { getDb } from "@/lib/db";

interface Ctx {
  params: Promise<{ peerId: string }>;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return jsonError("Unauthorized", 401);
  }
  const { peerId } = await ctx.params;

  const db = getDb();
  const peer = db
    .prepare(
      "SELECT id, uid, display_name, avatar_url FROM users WHERE id = ?",
    )
    .get(peerId) as
    | {
        id: string;
        uid: string;
        display_name: string | null;
        avatar_url: string | null;
      }
    | undefined;
  if (!peer) return jsonError("Peer not found", 404);

  const messages = getThread(user.id, peer.id);
  // Mark inbound messages read on read.
  markThreadRead(user.id, peer.id);

  return jsonOk({
    peer: {
      id: peer.id,
      uid: peer.uid,
      displayName: peer.display_name,
      avatarUrl: peer.avatar_url,
    },
    messages,
  });
}
