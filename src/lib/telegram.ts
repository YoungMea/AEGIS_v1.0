/**
 * Minimal Telegram Bot API wrapper.
 *
 * Two responsibilities:
 *   1. sendCode(chatId, code)   — push the OTP into a user's DM
 *   2. drainUpdates()           — long-poll getUpdates and resolve any
 *                                 pending verification_links rows when a user
 *                                 sends "/start <link_token>" to the bot.
 */
import { env } from "./env";
import { getDb } from "./db";

const API = "https://api.telegram.org";

function ensureToken() {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN is not configured. Set it in .env to use the telegram channel.",
    );
  }
}

interface TgResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

async function call<T>(method: string, body?: Record<string, unknown>): Promise<T> {
  ensureToken();
  const res = await fetch(`${API}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as TgResponse<T>;
  if (!json.ok) {
    throw new Error(`Telegram ${method} failed: ${json.description ?? res.status}`);
  }
  return json.result as T;
}

/**
 * Build the message a user receives in the bot.
 */
function formatCodeMessage(code: string): string {
  // Markdown V2 needs escaping; we keep things simple with HTML.
  return [
    `🛡 <b>${env.AGENCY_NAME} verification code</b>`,
    "",
    `<code>${code}</code>`,
    "",
    `<i>The code is valid for ${Math.floor(env.OTP_TTL_SECONDS / 60)} minutes.</i>`,
    `<i>Never share it with anyone.</i>`,
  ].join("\n");
}

export async function sendVerificationCode(
  chatId: string | number,
  code: string,
): Promise<void> {
  await call("sendMessage", {
    chat_id: chatId,
    text: formatCodeMessage(code),
    parse_mode: "HTML",
    disable_notification: false,
  });
}

interface TgUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; username?: string; first_name?: string };
    from?: { id: number; username?: string; first_name?: string };
    text?: string;
  };
}

/**
 * Pull recent updates and resolve verification_links rows when we see
 * a "/start <token>" command.
 *
 * We persist the offset cursor in kv_store so multiple poll cycles
 * never reprocess the same update.
 */
export async function drainUpdates(): Promise<{ processed: number }> {
  ensureToken();
  const db = getDb();
  const cursorRow = db
    .prepare("SELECT v FROM kv_store WHERE k = 'tg_offset'")
    .get() as { v: string } | undefined;
  const offset = cursorRow ? parseInt(cursorRow.v, 10) : 0;

  // Long-poll briefly. Browser polling triggers this every few seconds, so
  // we use a small timeout to keep responses snappy.
  const updates = await call<TgUpdate[]>("getUpdates", {
    offset: offset || undefined,
    timeout: 0,
    allowed_updates: ["message"],
  });

  let processed = 0;
  let maxId = offset;

  const resolveLink = db.prepare(
    `UPDATE verification_links
        SET chat_id = ?, username = ?
      WHERE link_token = ? AND chat_id IS NULL AND expires_at > ?`,
  );

  for (const u of updates) {
    if (u.update_id >= maxId) maxId = u.update_id + 1;
    const text = u.message?.text?.trim();
    if (!text || !text.startsWith("/start")) continue;

    const parts = text.split(/\s+/);
    const token = parts[1];
    if (!token) {
      // Greet the user even when they /start without a token.
      try {
        if (u.message?.chat?.id != null) {
          await call("sendMessage", {
            chat_id: u.message.chat.id,
            text: `🛡 <b>${env.AGENCY_NAME} verification</b>\n\nReturn to the registration page and tap "Open verification bot" so we can link your account.`,
            parse_mode: "HTML",
          });
        }
      } catch {
        /* ignore */
      }
      continue;
    }

    const chat = u.message?.chat;
    if (!chat) continue;

    const result = resolveLink.run(
      String(chat.id),
      chat.username ?? null,
      token,
      Date.now(),
    );
    if (result.changes > 0) {
      processed += 1;
      try {
        await call("sendMessage", {
          chat_id: chat.id,
          text: `✅ <b>Channel linked.</b>\nReturn to the AEGIS registration page — your verification code is on its way.`,
          parse_mode: "HTML",
        });
      } catch {
        /* ignore — UI flow doesn't depend on this confirmation */
      }
    }
  }

  // Save advanced cursor.
  db.prepare(
    `INSERT INTO kv_store (k, v) VALUES ('tg_offset', ?)
     ON CONFLICT(k) DO UPDATE SET v = excluded.v`,
  ).run(String(maxId));

  return { processed };
}

/**
 * Convenience: produce a deep-link the UI can open in a new tab.
 */
export function buildBotDeepLink(token: string): string {
  const username = env.TELEGRAM_BOT_USERNAME;
  if (!username) return "";
  return `https://t.me/${username}?start=${encodeURIComponent(token)}`;
}
