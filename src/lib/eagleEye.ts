/**
 * EagleEye — deep target reconnaissance.
 *
 * The eagle sees what others miss: archived snapshots, public profile
 * metadata, cross-platform aggregation and an AI-driven narrative summary.
 *
 * Pipeline:
 *   1. Run the standard HawkEye fan-out (USERNAME / EMAIL / PHONE) so we
 *      have a baseline list of confirmed accounts.
 *   2. Pull historical Instagram (and other socials when applicable)
 *      snapshots from the Internet Archive's Wayback Machine — useful even
 *      when the live profile is now private or deleted.
 *   3. Fetch extended Instagram public metadata (bio, follower count,
 *      profile picture, latest posts) when the account is public.
 *   4. Ask Gemini (or OpenRouter Gemma) to weave everything into a 3–4
 *      sentence narrative + a confidence score.
 *
 * The output is shaped so it can be appended to an existing AEGIS dossier
 * with one click — links flow into `socialMedia`, image URLs into
 * `evidenceImages` (downloaded as data URLs by the API route).
 */
import { probe, type ProbeResult } from "./hawkEye";

const TIMEOUT_MS = 10_000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/* --------------------------------------------------------- types */

export type EagleEyeMode = "username" | "email" | "phone";

export interface ArchiveSnapshot {
  url: string;        // wayback URL pointing to the snapshot
  timestamp: string;  // raw archive timestamp (YYYYMMDDhhmmss)
  source: string;     // e.g. "instagram.com/<handle>"
  date: string;       // ISO 8601 derived from timestamp
}

export interface InstagramMetadata {
  handle: string;
  url: string;
  fullName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  followers: number | null;
  following: number | null;
  posts: number | null;
  isPrivate: boolean | null;
  isVerified: boolean | null;
}

export interface AiSummary {
  narrative: string;
  confidence: number;   // 0–100 — likelihood the matches refer to one identity
  highlights: string[]; // 3–5 short bullet observations
  riskHints: string[];  // optional flags ("multiple aliases", "stale activity"…)
  provider: "gemini" | "openrouter" | "none";
}

export interface EagleEyeReport {
  query: string;
  mode: EagleEyeMode;
  startedAt: number;
  finishedAt: number;
  hawk: ProbeResult[];
  archive: ArchiveSnapshot[];
  instagram: InstagramMetadata | null;
  ai: AiSummary | null;
  /** Convenience aggregations for the dossier-append button. */
  links: string[];
  imageUrls: string[];
}

/* --------------------------------------------------------- helpers */

async function timed(
  url: string,
  opts: RequestInit = {},
): Promise<Response | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...opts,
      signal: ac.signal,
      redirect: opts.redirect ?? "follow",
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.7",
        ...(opts.headers ?? {}),
      },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function extract(html: string, regex: RegExp): string | null {
  const m = html.match(regex);
  return m ? m[1]!.trim() : null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/* --------------------------------------------------------- archive */

/**
 * Wayback Machine CDX API — returns up to 25 snapshots for the given URL,
 * newest first. Cheap, no key, very reliable.
 */
async function waybackSnapshots(
  targetUrl: string,
  source: string,
  limit = 12,
): Promise<ArchiveSnapshot[]> {
  const cdx = new URL("https://web.archive.org/cdx/search/cdx");
  cdx.searchParams.set("url", targetUrl);
  cdx.searchParams.set("output", "json");
  cdx.searchParams.set("filter", "statuscode:200");
  cdx.searchParams.set("collapse", "timestamp:8"); // dedupe by day
  cdx.searchParams.set("limit", `-${limit}`);     // last N

  const res = await timed(cdx.toString());
  if (!res || !res.ok) return [];
  try {
    const rows = (await res.json()) as string[][];
    if (!rows.length) return [];
    // First row is the header; skip it.
    return rows.slice(1).map((r) => {
      const [, timestamp, originalUrl] = r;
      return {
        timestamp: timestamp ?? "",
        url: `https://web.archive.org/web/${timestamp}/${originalUrl ?? targetUrl}`,
        source,
        date: timestampToIso(timestamp ?? ""),
      };
    });
  } catch {
    return [];
  }
}

function timestampToIso(ts: string): string {
  if (ts.length < 8) return "";
  const y = ts.slice(0, 4);
  const m = ts.slice(4, 6);
  const d = ts.slice(6, 8);
  const hh = ts.slice(8, 10) || "00";
  const mm = ts.slice(10, 12) || "00";
  return `${y}-${m}-${d}T${hh}:${mm}:00Z`;
}

/**
 * Resolve a list of archived snapshots given the active mode/query.
 * For username we hit each platform's profile URL; for email/phone we
 * skip — the archive doesn't index those anyway.
 */
async function collectArchive(
  mode: EagleEyeMode,
  query: string,
): Promise<ArchiveSnapshot[]> {
  if (mode !== "username") {
    return [];
  }
  const targets = [
    { url: `instagram.com/${query}/`, source: "Instagram" },
    { url: `tiktok.com/@${query}`, source: "TikTok" },
    { url: `t.me/${query}`, source: "Telegram" },
    { url: `twitter.com/${query}`, source: "Twitter / X" },
    { url: `github.com/${query}`, source: "GitHub" },
  ];

  const all = await Promise.all(
    targets.map((t) => waybackSnapshots(t.url, t.source, 5)),
  );
  return all
    .flat()
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, 20);
}

/* ------------------------------------------------ instagram metadata */

/**
 * Best-effort public Instagram metadata. The mobile-web profile page
 * embeds a JSON blob inside `<script type="application/ld+json">` and a
 * `<meta property="og:description">` summarising followers / following /
 * post count. We never authenticate — this only works when the account
 * is public.
 */
async function instagramMetadata(
  handle: string,
): Promise<InstagramMetadata | null> {
  const url = `https://www.instagram.com/${encodeURIComponent(handle)}/`;
  const res = await timed(url);
  if (!res || !res.ok) return null;
  const html = await res.text();

  if (
    html.includes("Sorry, this page isn&#x27;t available") ||
    html.includes("Page Not Found")
  ) {
    return null;
  }

  // og:description gives us the readable "X Followers · Y Following · Z Posts — see…"
  const ogDesc = extract(
    html,
    /<meta property="og:description" content="([^"]+)"/,
  );
  const ogTitle = extract(html, /<meta property="og:title" content="([^"]+)"/);
  const avatar = extract(
    html,
    /<meta property="og:image" content="([^"]+)"/,
  );

  let followers: number | null = null;
  let following: number | null = null;
  let posts: number | null = null;
  if (ogDesc) {
    const decoded = decodeHtmlEntities(ogDesc);
    // E.g. "10K Followers, 220 Following, 145 Posts — see…"
    const f = decoded.match(/([\d.,]+[KMB]?)\s+Followers/i);
    const fg = decoded.match(/([\d.,]+[KMB]?)\s+Following/i);
    const p = decoded.match(/([\d.,]+[KMB]?)\s+Posts?/i);
    followers = parseCount(f?.[1]);
    following = parseCount(fg?.[1]);
    posts = parseCount(p?.[1]);
  }

  // Try to detect privacy / verification.
  const isPrivate = /"is_private":true/.test(html);
  const isVerified = /"is_verified":true/.test(html);

  // Fallback name: og:title strips the "(@handle) • Instagram photos…" suffix.
  let fullName: string | null = null;
  if (ogTitle) {
    const decoded = decodeHtmlEntities(ogTitle);
    fullName = decoded.split(" (@")[0]?.trim() || null;
  }

  // Bio is delivered in JSON state — extract a best-effort snippet.
  const bio = extract(html, /"biography":"([^"]*)"/);

  return {
    handle,
    url,
    fullName,
    bio: bio ? decodeUnicodeEscapes(bio) : null,
    avatarUrl: avatar ?? null,
    followers,
    following,
    posts,
    isPrivate,
    isVerified,
  };
}

function decodeUnicodeEscapes(s: string): string {
  return s.replace(/\\u([0-9a-fA-F]{4})/g, (_m, code) =>
    String.fromCharCode(parseInt(code as string, 16)),
  );
}

function parseCount(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "");
  const m = cleaned.match(/^([\d.]+)\s*([KMB])?$/i);
  if (!m) return null;
  const n = parseFloat(m[1]!);
  const suffix = (m[2] ?? "").toUpperCase();
  if (suffix === "K") return Math.round(n * 1_000);
  if (suffix === "M") return Math.round(n * 1_000_000);
  if (suffix === "B") return Math.round(n * 1_000_000_000);
  return Math.round(n);
}

/* --------------------------------------------------------- AI */

interface GeminiTextResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}
interface OpenAiTextResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

const NARRATIVE_PROMPT = `You are an OSINT analyst summarising the trail left
by a single subject across multiple platforms.

You will receive structured JSON describing:
  - the original query (a username, email or phone number)
  - the per-platform probe results (status, profile url, display name)
  - any Instagram public metadata
  - any Wayback Machine archive snapshots

Respond with **strict JSON** (no markdown, no commentary) shaped exactly:
{
  "narrative": "<3-4 sentence English narrative tying the matches to a single
                identity, hedging when the evidence is weak>",
  "confidence": <0-100 integer — how likely all matches refer to one person>,
  "highlights": ["<short observation>", ...],            // 3-5 entries
  "riskHints": ["<flag>", ...]                           // 0-3 entries
}

Be cautious: do NOT invent profile URLs that are absent from the input.
Reference platforms by name (Telegram, TikTok, Instagram, GitHub, …).`;

async function summariseWithAi(
  payload: object,
): Promise<AiSummary | null> {
  const orKey = (process.env.OPENROUTER_API_KEY ?? "").trim();
  const geminiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!orKey && !geminiKey) return null;
  const primary = (process.env.AEGIS_AI_PRIMARY ?? "gemini").toLowerCase();

  const tryGemini = () =>
    geminiKey ? callGemini(payload, geminiKey) : Promise.resolve(null);
  const tryOpenRouter = () =>
    orKey ? callOpenRouter(payload, orKey) : Promise.resolve(null);

  if (primary === "openrouter") {
    return (await tryOpenRouter()) ?? (await tryGemini());
  }
  return (await tryGemini()) ?? (await tryOpenRouter());
}

async function callGemini(
  payload: object,
  apiKey: string,
): Promise<AiSummary | null> {
  const model = (process.env.GEMINI_TEXT_MODEL ?? "gemini-2.0-flash").trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 45_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: NARRATIVE_PROMPT },
              { text: JSON.stringify(payload) },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
        },
      }),
      signal: ac.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as GeminiTextResponse;
    const txt = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return parseAi(txt, "gemini");
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function callOpenRouter(
  payload: object,
  apiKey: string,
): Promise<AiSummary | null> {
  const model = (
    process.env.OPENROUTER_TEXT_MODEL ??
    process.env.OPENROUTER_VISION_MODEL ??
    "google/gemma-4-31b-it:free"
  ).trim();
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 45_000);
  try {
    const res = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            process.env.OPENROUTER_SITE_URL ?? "https://aegis.local",
          "X-Title": "AEGIS / EagleEye",
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          max_tokens: 800,
          messages: [
            {
              role: "user",
              content: `${NARRATIVE_PROMPT}\n\nINPUT:\n${JSON.stringify(payload)}`,
            },
          ],
        }),
        signal: ac.signal,
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as OpenAiTextResponse;
    const txt = json.choices?.[0]?.message?.content ?? "";
    return parseAi(txt, "openrouter");
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function parseAi(
  raw: string,
  provider: "gemini" | "openrouter",
): AiSummary | null {
  if (!raw) return null;
  // Free models occasionally wrap JSON in ```json fences.
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  // Find first object — be tolerant of model preambles.
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd < 0) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1)) as Partial<
      AiSummary
    >;
    return {
      narrative: typeof parsed.narrative === "string" ? parsed.narrative : "",
      confidence:
        typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(100, Math.round(parsed.confidence)))
          : 0,
      highlights: Array.isArray(parsed.highlights)
        ? parsed.highlights.filter((s): s is string => typeof s === "string")
        : [],
      riskHints: Array.isArray(parsed.riskHints)
        ? parsed.riskHints.filter((s): s is string => typeof s === "string")
        : [],
      provider,
    };
  } catch {
    return null;
  }
}

/* --------------------------------------------------------- pipeline */

import {
  EMAIL_PLATFORMS,
  PHONE_PLATFORMS,
  USERNAME_PLATFORMS,
  type HawkEyePlatform,
} from "./hawkEye";

export interface EagleEyeRunOptions {
  mode: EagleEyeMode;
  query: string;
  /** When true, skip the AI step (useful when no key is configured). */
  skipAi?: boolean;
}

export async function runEagleEye(
  opts: EagleEyeRunOptions,
): Promise<EagleEyeReport> {
  const startedAt = Date.now();
  const platforms: HawkEyePlatform[] =
    opts.mode === "email"
      ? [...EMAIL_PLATFORMS, ...USERNAME_PLATFORMS.filter((p) => p !== "github")]
      : opts.mode === "phone"
        ? PHONE_PLATFORMS
        : USERNAME_PLATFORMS;

  const queryFor = (p: HawkEyePlatform): string => {
    if (opts.mode !== "email") return opts.query;
    if (p === "gravatar" || p === "github") return opts.query;
    return opts.query.split("@")[0] ?? opts.query;
  };

  // 1. Run HawkEye fan-out in parallel.
  const hawk = await Promise.all(
    platforms.map(async (p) => {
      try {
        return await probe(p, queryFor(p));
      } catch (e) {
        return {
          platform: p,
          status: "error" as const,
          url: null,
          display: null,
          detail: e instanceof Error ? e.message : "Unknown error",
          durationMs: 0,
        };
      }
    }),
  );

  // 2. Wayback archive (username-only).
  const archive = await collectArchive(opts.mode, opts.query);

  // 3. Instagram extended metadata. Only attempts the live fetch when the
  //    HawkEye instagram probe came back as found OR when we're in
  //    username mode (in email mode we also try with the localpart).
  const igHandle =
    opts.mode === "username"
      ? opts.query
      : opts.mode === "email"
        ? opts.query.split("@")[0] ?? null
        : null;
  const igProbe = hawk.find((h) => h.platform === "instagram");
  const tryIg =
    !!igHandle && (igProbe?.status === "found" || opts.mode === "username");
  const instagram = tryIg ? await instagramMetadata(igHandle!) : null;

  // 4. AI summary stitches it together.
  const ai =
    opts.skipAi
      ? null
      : await summariseWithAi({
          query: opts.query,
          mode: opts.mode,
          hawk: hawk
            .filter((h) => h.status === "found" || h.status === "unclear")
            .map((h) => ({
              platform: h.platform,
              status: h.status,
              url: h.url,
              display: h.display,
              detail: h.detail,
            })),
          instagram,
          archive: archive.slice(0, 8),
        });

  // Aggregate links + image URLs for the dossier-append button.
  const links = new Set<string>();
  for (const h of hawk) {
    if (h.status === "found" && h.url && h.url.startsWith("http")) {
      links.add(h.url);
    }
  }
  for (const a of archive) links.add(a.url);
  if (instagram?.url) links.add(instagram.url);

  const imageUrls = new Set<string>();
  if (instagram?.avatarUrl) imageUrls.add(instagram.avatarUrl);

  return {
    query: opts.query,
    mode: opts.mode,
    startedAt,
    finishedAt: Date.now(),
    hawk,
    archive,
    instagram,
    ai,
    links: Array.from(links),
    imageUrls: Array.from(imageUrls),
  };
}
