"use client";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/chat";

type Status = "connecting" | "open" | "closed";

interface Options {
  enabled?: boolean;
  onMessage?: (msg: ChatMessage) => void;
  onPresence?: (userId: string, online: boolean) => void;
}

/**
 * Subscribes to /api/chat/stream and dispatches incoming events.
 *
 * EventSource handles reconnection by itself, so we only have to manage
 * the lifecycle (connect on mount, disconnect on unmount).
 *
 * We deliberately keep the dependency array empty for the open/close
 * effect — the listeners use refs so they always see the latest callbacks
 * without forcing the stream to be torn down on every render.
 */
export function useChatStream({ enabled = true, onMessage, onPresence }: Options) {
  const [status, setStatus] = useState<Status>("connecting");
  const [onlineSet, setOnlineSet] = useState<Set<string>>(new Set());
  const onMessageRef = useRef(onMessage);
  const onPresenceRef = useRef(onPresence);

  onMessageRef.current = onMessage;
  onPresenceRef.current = onPresence;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setStatus("closed");
      return;
    }

    setStatus("connecting");
    const es = new EventSource("/api/chat/stream", { withCredentials: true });

    const handleOpen = () => setStatus("open");
    const handleError = () => {
      // EventSource will retry on its own; mark UI as connecting until it does.
      setStatus("connecting");
    };

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

    es.addEventListener("open", handleOpen);
    es.addEventListener("error", handleError);
    es.addEventListener("ready", handleReady as EventListener);
    es.addEventListener("message", handleMessage as EventListener);
    es.addEventListener("presence", handlePresence as EventListener);

    return () => {
      es.removeEventListener("open", handleOpen);
      es.removeEventListener("error", handleError);
      es.removeEventListener("ready", handleReady as EventListener);
      es.removeEventListener("message", handleMessage as EventListener);
      es.removeEventListener("presence", handlePresence as EventListener);
      es.close();
      setStatus("closed");
    };
  }, [enabled]);

  return { status, onlineSet };
}
