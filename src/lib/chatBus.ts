/**
 * In-memory pub/sub for AntChat real-time delivery.
 *
 * For a single-node deployment (Render free tier), this is simple and fast.
 * In a multi-node setup you would swap this for Redis pub/sub or similar.
 */
import type { ChatMessage } from "./chat";

export type ChatEvent =
  | { type: "message"; message: ChatMessage }
  | { type: "presence"; userId: string; online: boolean }
  | {
      type: "read";
      conversationKey: string;
      readerId: string;
      readAt: number;
    }
  | {
      type: "typing";
      conversationKey: string;
      typerId: string;
      /** Until what timestamp the typing should be visible. */
      until: number;
    };

type Subscriber = (event: ChatEvent) => void;

interface SubscribeOptions {
  /** Only receive messages relevant to this user (sent or received). */
  userId: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __aegisChatBus:
    | {
        subscribers: Map<symbol, { fn: Subscriber; userId: string }>;
        online: Map<string, number>; // userId → reference count
      }
    | undefined;
}

function getStore() {
  if (!globalThis.__aegisChatBus) {
    globalThis.__aegisChatBus = {
      subscribers: new Map(),
      online: new Map(),
    };
  }
  return globalThis.__aegisChatBus;
}

export function subscribe(
  fn: Subscriber,
  opts: SubscribeOptions,
): () => void {
  const store = getStore();
  const key = Symbol("aegis-chat-sub");
  store.subscribers.set(key, { fn, userId: opts.userId });

  // Bump presence counter and broadcast if this is the user's first stream.
  const prev = store.online.get(opts.userId) ?? 0;
  store.online.set(opts.userId, prev + 1);
  if (prev === 0) {
    broadcast({ type: "presence", userId: opts.userId, online: true });
  }

  return () => {
    store.subscribers.delete(key);
    const current = store.online.get(opts.userId) ?? 0;
    if (current <= 1) {
      store.online.delete(opts.userId);
      broadcast({ type: "presence", userId: opts.userId, online: false });
    } else {
      store.online.set(opts.userId, current - 1);
    }
  };
}

export function broadcast(event: ChatEvent): void {
  const store = getStore();

  // Pre-compute the set of user ids that should receive this event.
  let recipients: Set<string> | null = null;
  if (event.type === "message") {
    recipients = new Set([event.message.senderId, event.message.recipientId]);
  } else if (event.type === "read" || event.type === "typing") {
    // Conversation key is "<userIdA>:<userIdB>" in sorted order.
    const [a, b] = event.conversationKey.split(":");
    recipients = new Set([a!, b!]);
  }
  // Presence: deliver to every active subscriber.

  for (const sub of store.subscribers.values()) {
    if (recipients && !recipients.has(sub.userId)) continue;
    try {
      sub.fn(event);
    } catch {
      /* keep going */
    }
  }
}

export function isOnline(userId: string): boolean {
  return (getStore().online.get(userId) ?? 0) > 0;
}

export function snapshotOnline(): string[] {
  return Array.from(getStore().online.keys());
}
