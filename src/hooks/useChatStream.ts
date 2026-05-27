"use client";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/chat";

type Status = "connecting" | "open" | "closed";

export interface ReadEvent {
  conversationKey: string;
  readerId: string;
  readAt: number;
}

export interface TypingEvent {
  conversationKey: string;
  typerId: string;
  until: number;
}

interface Options {
  enabled?: boolean;
  onMessage?: (msg: ChatMessage) => void;
  onPresence?: (userId: string, online: boolean) => void;
  onRead?: (event: ReadEvent) => void;
  onTyping?: (event: TypingEvent) => void;
}

/**
 * Subscribes to /api/chat/stream and dispatches incoming events.
 *
 * EventSource handles reconnection by itself, so we only have to manage
 * the lifecycle (connect on mount, disconnect on unmount).
 *
 * Listeners are accessed via refs so callers can update them between
 * renders without forcing the underlying socket to reconnect.
 */
export function useChatStream({
  enabled = true,
  onMessage,
  onPresence,
  onRead,
  onTyping,
}: Options) {
  const [status, setStatus] = useState<Status>("connecting");
  const [onlineSet, setOnlineSet] = useState<Set<string>>(new Set());
  const onMessageRef = useRef(onMessage);
  const onPresenceRef = useRef(onPresence);
  const onReadRef = useRef(onRead);
  const onTypingRef = useRef(onTyping);

  onMessageRef.current = onMessage;
  onPresenceRef.current = onPresence;
  onReadRef.current = onRead;
  onTypingRef.current = onTyping;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setStatus("closed");
      return;
    }

    setStatus("connecting");
    const es = new EventSource("/api/chat/stream", { withCredentials: true });

    const handleOpen = () => setStatus("open");
    const handleError = () => setStatus("connecting");
    const handleReady = () => setStatus("open");

    const handleMessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as ChatMessage;
        onMessageRef.current?.(data);
      } catch {
        /* ignore malformed payloads */
      }
    };

    const handlePresence = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as {
          userId: string;
          online: boolean;
        };
        setOnlineSet((prev) => {
          const next = new Set(prev);
          if (data.online) next.add(data.userId);
          else next.delete(data.userId);
          return next;
        });
        onPresenceRef.current?.(data.userId, data.online);
      } catch {
        /* ignore */
      }
    };

    const handleRead = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as ReadEvent;
        onReadRef.current?.(data);
      } catch {
        /* ignore */
      }
    };

    const handleTyping = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as TypingEvent;
        onTypingRef.current?.(data);
      } catch {
        /* ignore */
      }
    };

    es.addEventListener("open", handleOpen);
    es.addEventListener("error", handleError);
    es.addEventListener("ready", handleReady as EventListener);
    es.addEventListener("message", handleMessage as EventListener);
    es.addEventListener("presence", handlePresence as EventListener);
    es.addEventListener("read", handleRead as EventListener);
    es.addEventListener("typing", handleTyping as EventListener);

    return () => {
      es.removeEventListener("open", handleOpen);
      es.removeEventListener("error", handleError);
      es.removeEventListener("ready", handleReady as EventListener);
      es.removeEventListener("message", handleMessage as EventListener);
      es.removeEventListener("presence", handlePresence as EventListener);
      es.removeEventListener("read", handleRead as EventListener);
      es.removeEventListener("typing", handleTyping as EventListener);
      es.close();
      setStatus("closed");
    };
  }, [enabled]);

  return { status, onlineSet };
}
