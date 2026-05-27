/**
 * AntChat — encrypted operative-to-operative messaging.
 *
 * Every body, attachment and dossier snapshot is encrypted with NoLook.
 * The conversation_key is built from a sorted pair of user UIDs so we can
 * fetch a thread without scanning both directions.
 *
 * File payloads are stored inline as base64 inside the SQLite row. This
 * keeps the deployment footprint to a single database file (good for free
 * hosting), at the cost of a hard ceiling on attachment size.
 */
import { getDb } from "./db";
import { cuid } from "./ids";
import {
  decryptJson,
  decryptNullable,
  decryptString,
  encryptJson,
  encryptNullable,
  encryptString,
} from "./noLook";
import { getDossier } from "./dossier";
import { broadcast } from "./chatBus";

export const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB hard cap on inline attachments

export type ChatKind = "text" | "file" | "dossier";

export interface ChatMessage {
  id: string;
  conversationKey: string;
  senderId: string;
  recipientId: string;
  kind: ChatKind;
  body: string | null;
  file: null | {
    name: string;
    mime: string;
    size: number;
    /** Always present on the read path so the UI can render previews. */
    dataBase64: string;
  };
  dossier: null | {
    ref: string;
    snapshot: DossierSnapshot;
  };
  createdAt: number;
  readAt: number | null;
}

export interface DossierSnapshot {
  fullName: string | null;
  alias: string | null;
  classification: string;
  riskLevel: string;
  status: string;
  city: string | null;
  country: string | null;
  tags: string[];
  notes: string | null;
  ref: string;
}

export function conversationKey(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join(":");
}

interface MessageRow {
  id: string;
  conversation_key: string;
  sender_id: string;
  recipient_id: string;
  kind: ChatKind;
  body: string | null;
  file_name: string | null;
  file_mime: string | null;
  file_size: number | null;
  file_data: string | null;
  dossier_ref: string | null;
  dossier_summary: string | null;
  created_at: number;
  read_at: number | null;
}

function aadFor(messageId: string): string {
  return `chat:${messageId}`;
}

function rowToMessage(r: MessageRow): ChatMessage {
  const aad = aadFor(r.id);
  let file: ChatMessage["file"] = null;
  if (r.kind === "file" && r.file_data) {
    file = {
      name: decryptNullable(r.file_name, aad) ?? "attachment",
      mime: r.file_mime ?? "application/octet-stream",
      size: r.file_size ?? 0,
      dataBase64: decryptString(r.file_data, aad),
    };
  }

  let dossier: ChatMessage["dossier"] = null;
  if (r.kind === "dossier" && r.dossier_summary) {
    const snap = decryptJson<DossierSnapshot>(r.dossier_summary, aad);
    if (snap) {
      dossier = {
        ref: decryptNullable(r.dossier_ref, aad) ?? "",
        snapshot: snap,
      };
    }
  }

  return {
    id: r.id,
    conversationKey: r.conversation_key,
    senderId: r.sender_id,
    recipientId: r.recipient_id,
    kind: r.kind,
    body: r.kind === "text" ? decryptNullable(r.body, aad) : null,
    file,
    dossier,
    createdAt: r.created_at,
    readAt: r.read_at,
  };
}

export interface ConversationSummary {
  conversationKey: string;
  peer: {
    id: string;
    uid: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  lastMessage: ChatMessage | null;
  unread: number;
}

/**
 * List the active user's conversations sorted by latest activity, with the
 * most recent message inlined.
 */
export function listConversations(userId: string): ConversationSummary[] {
  const db = getDb();
  // Pull every message touching this user, ordered newest-first; we then walk
  // in JS to dedupe by conversation_key. This is fine for the demo scale.
  const rows = db
    .prepare(
      `SELECT * FROM chat_messages
        WHERE sender_id = ? OR recipient_id = ?
        ORDER BY created_at DESC
        LIMIT 500`,
    )
    .all(userId, userId) as MessageRow[];

  const seen = new Map<string, MessageRow>();
  for (const r of rows) {
    if (!seen.has(r.conversation_key)) seen.set(r.conversation_key, r);
  }

  // Unread per conversation.
  const unreadRows = db
    .prepare(
      `SELECT conversation_key, COUNT(*) as n
         FROM chat_messages
        WHERE recipient_id = ? AND read_at IS NULL
        GROUP BY conversation_key`,
    )
    .all(userId) as { conversation_key: string; n: number }[];
  const unread = new Map(unreadRows.map((r) => [r.conversation_key, r.n]));

  const result: ConversationSummary[] = [];
  for (const row of seen.values()) {
    const peerId = row.sender_id === userId ? row.recipient_id : row.sender_id;
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
    if (!peer) continue;
    result.push({
      conversationKey: row.conversation_key,
      peer: {
        id: peer.id,
        uid: peer.uid,
        displayName: peer.display_name,
        avatarUrl: peer.avatar_url,
      },
      lastMessage: rowToMessage(row),
      unread: unread.get(row.conversation_key) ?? 0,
    });
  }
  // Already newest first because we iterated rows by descending created_at.
  return result;
}

export function getThread(
  userId: string,
  peerId: string,
  limit = 200,
): ChatMessage[] {
  const db = getDb();
  const key = conversationKey(userId, peerId);
  const rows = db
    .prepare(
      `SELECT * FROM chat_messages
        WHERE conversation_key = ?
          AND (sender_id = ? OR recipient_id = ?)
        ORDER BY created_at ASC
        LIMIT ?`,
    )
    .all(key, userId, userId, limit) as MessageRow[];
  return rows.map(rowToMessage);
}

export function markThreadRead(userId: string, peerId: string): number {
  const db = getDb();
  const key = conversationKey(userId, peerId);
  const now = Date.now();
  const r = db
    .prepare(
      `UPDATE chat_messages
          SET read_at = ?
        WHERE conversation_key = ? AND recipient_id = ? AND read_at IS NULL`,
    )
    .run(now, key, userId);
  if (r.changes > 0) {
    // Notify the other side so its tick marks turn green in real-time.
    broadcast({
      type: "read",
      conversationKey: key,
      readerId: userId,
      readAt: now,
    });
  }
  return r.changes;
}

export function totalUnread(userId: string): number {
  const db = getDb();
  const r = db
    .prepare(
      "SELECT COUNT(*) AS n FROM chat_messages WHERE recipient_id = ? AND read_at IS NULL",
    )
    .get(userId) as { n: number };
  return r.n;
}

export interface SendMessageInput {
  senderId: string;
  recipientId: string;
  kind: ChatKind;
  text?: string;
  file?: {
    name: string;
    mime: string;
    size: number;
    dataBase64: string;
  };
  dossierId?: string;
}

export function sendMessage(input: SendMessageInput): ChatMessage {
  if (input.senderId === input.recipientId) {
    throw new Error("CANNOT_MESSAGE_SELF");
  }
  const db = getDb();
  // Confirm recipient exists.
  const recipient = db
    .prepare("SELECT id FROM users WHERE id = ?")
    .get(input.recipientId);
  if (!recipient) throw new Error("RECIPIENT_NOT_FOUND");

  const id = cuid();
  const aad = aadFor(id);
  const now = Date.now();
  const key = conversationKey(input.senderId, input.recipientId);

  let body: string | null = null;
  let fileName: string | null = null;
  let fileMime: string | null = null;
  let fileSize: number | null = null;
  let fileData: string | null = null;
  let dossierRef: string | null = null;
  let dossierSummary: string | null = null;

  if (input.kind === "text") {
    const txt = (input.text ?? "").trim();
    if (!txt) throw new Error("EMPTY_BODY");
    if (txt.length > 4000) throw new Error("BODY_TOO_LONG");
    body = encryptString(txt, aad);
  } else if (input.kind === "file") {
    if (!input.file) throw new Error("FILE_MISSING");
    const { name, mime, size, dataBase64 } = input.file;
    if (!dataBase64 || size <= 0 || size > MAX_FILE_BYTES) {
      throw new Error("FILE_INVALID");
    }
    fileName = encryptString(name.slice(0, 200), aad);
    fileMime = mime.slice(0, 120) || "application/octet-stream";
    fileSize = size;
    fileData = encryptString(dataBase64, aad);
  } else if (input.kind === "dossier") {
    if (!input.dossierId) throw new Error("DOSSIER_MISSING");
    const d = getDossier(input.dossierId, input.senderId);
    if (!d) throw new Error("DOSSIER_NOT_FOUND");
    const snap: DossierSnapshot = {
      fullName: d.fullName,
      alias: d.alias,
      classification: d.classification,
      riskLevel: d.riskLevel,
      status: d.status,
      city: d.city,
      country: d.country,
      tags: d.tags,
      notes: d.notes,
      ref: d.id,
    };
    dossierRef = encryptString(d.id, aad);
    dossierSummary = encryptJson(snap, aad);
  } else {
    throw new Error("UNKNOWN_KIND");
  }

  db.prepare(
    `INSERT INTO chat_messages
      (id, conversation_key, sender_id, recipient_id, kind, body,
       file_name, file_mime, file_size, file_data,
       dossier_ref, dossier_summary, created_at, read_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`,
  ).run(
    id,
    key,
    input.senderId,
    input.recipientId,
    input.kind,
    body,
    fileName,
    fileMime,
    fileSize,
    fileData,
    dossierRef,
    dossierSummary,
    now,
  );

  return rowToMessage({
    id,
    conversation_key: key,
    sender_id: input.senderId,
    recipient_id: input.recipientId,
    kind: input.kind,
    body,
    file_name: fileName,
    file_mime: fileMime,
    file_size: fileSize,
    file_data: fileData,
    dossier_ref: dossierRef,
    dossier_summary: dossierSummary,
    created_at: now,
    read_at: null,
  });
}

/**
 * Same as sendMessage, but additionally publishes the message to the chat
 * bus so any active SSE streams receive it instantly. Use this from API
 * handlers; sendMessage stays available for tests / batch ingestion that
 * shouldn't broadcast.
 */
export function sendMessageAndBroadcast(input: SendMessageInput): ChatMessage {
  const message = sendMessage(input);
  broadcast({ type: "message", message });
  return message;
}
