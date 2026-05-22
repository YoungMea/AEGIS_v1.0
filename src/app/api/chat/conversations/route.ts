/**
 * GET /api/chat/conversations
 * List the active user's conversations with last-message previews.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listConversations, totalUnread } from "@/lib/chat";

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return jsonError("Unauthorized", 401);
  }
  return jsonOk({
    conversations: listConversations(user.id),
    unread: totalUnread(user.id),
  });
}
