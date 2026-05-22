/**
 * In-memory pub/sub for AntChat real-time delivery.
 *
 * For a single-node deployment (Render free tier), this is simple and fast.
 * In a multi-node setup you would swap this for Redis pub/sub or similar.
 */
import type { ChatMessage } from "./chat";

export type ChatEvent =
  | { type: "message"; message: ChatMessage }
  | { type: "presence"; userId: string; online: boolean };

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
  for (const sub of store.subscribers.values()) {
    if (event.type === "message") {
      // Only notify sender and recipient.
      if (
        sub.userId === event.message.senderId ||
        sub.userId === event.message.recipientId
      ) {
        try {
          sub.fn(event);
        } catch {
          /* keep going */
        }
      }
    } else {
      // Presence: deliver to everyone.
      try {
        sub.fn(event);
      } catch {
        /* keep going */
      }
    }
  }
}

export function isOnline(userId: string): boolean {
  return (getStore().online.get(userId) ?? 0) > 0;
}

export function snapshotOnline(): string[] {
  return Array.from(getStore().online.keys());
}
