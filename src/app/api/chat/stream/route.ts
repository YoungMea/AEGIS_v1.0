/**
 * GET /api/chat/stream  (Server-Sent Events)
 *
 * Long-lived stream that pushes:
 *   - "message"  — every new chat message touching the active user
 *   - "presence" — online/offline transitions for any operative
 *   - "ping"     — periodic keep-alive so proxies don't close the socket
 *
 * Why SSE instead of WebSockets:
 *   - Plain HTTP, no upgrade handshake → works on Render free tier
 *   - Simpler reconnection (the browser handles it via EventSource)
 *   - One-way push is exactly what we need
 */
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { subscribe } from "@/lib/chatBus";

// Force the route into the Node.js runtime — the chat bus uses globalThis
// and would not survive in the Edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEEPALIVE_MS = 25_000; // shorter than the 30s Render proxy idle limit

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const safeSend = (raw: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(raw));
        } catch {
          closed = true;
        }
      };

      const sendEvent = (event: string, data: unknown) => {
        safeSend(`event: ${event}\n`);
        safeSend(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Initial "hello" so the client knows the stream is up.
      sendEvent("ready", { ok: true, ts: Date.now() });

      // Subscribe to the bus.
      const unsubscribe = subscribe(
        (ev) => {
          if (ev.type === "message") sendEvent("message", ev.message);
          else if (ev.type === "presence") sendEvent("presence", ev);
          else if (ev.type === "read") sendEvent("read", ev);
          else if (ev.type === "typing") sendEvent("typing", ev);
        },
        { userId: user.id },
      );

      // Keep-alive comment frames (ignored by EventSource consumers).
      const ka = setInterval(() => {
        safeSend(`: ping ${Date.now()}\n\n`);
      }, KEEPALIVE_MS);

      // Tear down when the client disconnects.
      const onAbort = () => {
        if (closed) return;
        closed = true;
        clearInterval(ka);
        try {
          unsubscribe();
        } catch {
          /* ignore */
        }
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };

      req.signal.addEventListener("abort", onAbort);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable buffering on common reverse proxies (nginx) so events
      // aren't held back until the buffer fills.
      "X-Accel-Buffering": "no",
    },
  });
}
