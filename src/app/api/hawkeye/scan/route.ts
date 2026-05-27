/**
 * GET /api/hawkeye/scan?mode=username&q=...
 * GET /api/hawkeye/scan?mode=email&q=...
 *
 * Streams probe results back over Server-Sent Events. Each event payload
 * is a single ProbeResult JSON object. Probes run in parallel — clients
 * see results trickle in as each platform responds, so the UI feels
 * tactical and live rather than blocking on the slowest target.
 */
import type { NextRequest } from "next/server";
import {
  EMAIL_PLATFORMS,
  PHONE_PLATFORMS,
  USERNAME_PLATFORMS,
  normaliseEmail,
  normalisePhone,
  normaliseUsername,
  probe,
  type HawkEyePlatform,
  type ProbeResult,
} from "@/lib/hawkEye";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sseLine(name: string, data: unknown): string {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const modeParam = searchParams.get("mode");
  const mode =
    modeParam === "email"
      ? "email"
      : modeParam === "phone"
        ? "phone"
        : "username";
  const raw = searchParams.get("q") ?? "";

  const query =
    mode === "email"
      ? normaliseEmail(raw)
      : mode === "phone"
        ? normalisePhone(raw)
        : normaliseUsername(raw);
  if (!query) {
    return new Response("Invalid query", { status: 400 });
  }

  // 6 scans/min/user — generous for normal use, blocks runaway loops.
  if (
    !rateLimit({
      bucket: "hawkeye:scan:user",
      key: user.id,
      limit: 6,
      windowSec: 60,
    }).allowed
  ) {
    return new Response("Slow down", { status: 429 });
  }

  const platforms: HawkEyePlatform[] =
    mode === "email"
      ? EMAIL_PLATFORMS
      : mode === "phone"
        ? PHONE_PLATFORMS
        : USERNAME_PLATFORMS;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(sseLine(event, data)));
        } catch {
          /* ignore */
        }
      };

      // Open envelope so the client knows what to expect.
      send("start", {
        mode,
        query,
        platforms,
        startedAt: Date.now(),
      });

      // Fan probes out in parallel; emit each one as it resolves.
      await Promise.all(
        platforms.map(async (p) => {
          send("pending", { platform: p });
          let result: ProbeResult;
          try {
            result = await probe(p, query);
          } catch (e) {
            result = {
              platform: p,
              status: "error",
              url: null,
              display: null,
              detail: e instanceof Error ? e.message : "Unknown error",
              durationMs: 0,
            };
          }
          send("result", result);
        }),
      );

      send("done", { finishedAt: Date.now() });
      closed = true;
      try {
        controller.close();
      } catch {
        /* ignore */
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
