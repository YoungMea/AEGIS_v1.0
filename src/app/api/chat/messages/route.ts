/**
 * POST /api/chat/messages
 * Send a message: text, file (base64) or dossier reference.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk, safeJson, fromZod } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { sendMessageAndBroadcast as sendMessage, MAX_FILE_BYTES } from "@/lib/chat";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { z, ZodError } from "zod";

const fileSchema = z.object({
  name: z.string().min(1).max(200),
  mime: z.string().max(120),
  size: z.number().int().positive().max(MAX_FILE_BYTES),
  dataBase64: z.string().max(Math.ceil((MAX_FILE_BYTES * 4) / 3) + 64),
});

const schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    recipientId: z.string().min(1),
    text: z.string().min(1).max(4000),
  }),
  z.object({
    kind: z.literal("file"),
    recipientId: z.string().min(1),
    file: fileSchema,
  }),
  z.object({
    kind: z.literal("dossier"),
    recipientId: z.string().min(1),
    dossierId: z.string().min(1),
  }),
]);

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return jsonError("Unauthorized", 401);
  }

  // Per-user limit: 60 messages/min is plenty even for long bursts.
  const limit = rateLimit({
    bucket: "chat:send:user",
    key: user.id,
    limit: 60,
    windowSec: 60,
  });
  if (!limit.allowed) return jsonError("Slow down", 429);

  // IP guard against abuse from public endpoints.
  rateLimit({
    bucket: "chat:send:ip",
    key: clientIp(req),
    limit: 200,
    windowSec: 60,
  });

  const body = await safeJson(req);
  let parsed;
  try {
    parsed = schema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) return jsonError("Invalid input", 400, fromZod(e));
    return jsonError("Invalid input");
  }

  try {
    const message =
      parsed.kind === "text"
        ? sendMessage({
            senderId: user.id,
            recipientId: parsed.recipientId,
            kind: "text",
            text: parsed.text,
          })
        : parsed.kind === "file"
          ? sendMessage({
              senderId: user.id,
              recipientId: parsed.recipientId,
              kind: "file",
              file: parsed.file,
            })
          : sendMessage({
              senderId: user.id,
              recipientId: parsed.recipientId,
              kind: "dossier",
              dossierId: parsed.dossierId,
            });

    return jsonOk({ message }, 201);
  } catch (e) {
    const map: Record<string, [string, number]> = {
      RECIPIENT_NOT_FOUND: ["Recipient not found", 404],
      CANNOT_MESSAGE_SELF: ["Cannot message yourself", 400],
      DOSSIER_NOT_FOUND: ["Dossier not found", 404],
      EMPTY_BODY: ["Message is empty", 400],
      BODY_TOO_LONG: ["Message too long", 413],
      FILE_INVALID: ["Attachment is too large or invalid", 413],
      FILE_MISSING: ["File missing", 400],
      DOSSIER_MISSING: ["Dossier id missing", 400],
      UNKNOWN_KIND: ["Unsupported message kind", 400],
    };
    const msg = (e as Error).message;
    const [text, status] = map[msg] ?? ["Could not send message", 500];
    return jsonError(text, status);
  }
}
