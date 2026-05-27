/**
 * HawkEye — username / email reconnaissance.
 *
 * Each probe is a stateless HTTP fetch with a strict timeout. We never
 * authenticate against the target platforms — only public endpoints are
 * touched. Results are bucketed into:
 *   - "found"    : strong evidence the handle exists
 *   - "not-found": explicit 404 / "user not found" markers
 *   - "unclear"  : 200 reached but signal is ambiguous (login wall etc.)
 *   - "error"    : network/timeout/protected (probably bot detection)
 *
 * The intent is OSINT, not credential testing — so we accept some false
 * negatives (better than false positives).
 */
import crypto from "node:crypto";

const TIMEOUT_MS = 9_000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export type ProbeStatus = "found" | "not-found" | "unclear" | "error";

export interface ProbeResult {
  platform: HawkEyePlatform;
  status: ProbeStatus;
  url: string | null;
  display: string | null; // e.g. profile name pulled from page
  detail: string | null;  // human-readable hint, e.g. "Login wall"
  durationMs: number;
}

export type HawkEyePlatform =
  | "telegram"
  | "tiktok"
  | "instagram"
  | "snapchat"
  | "gravatar";

export type HawkEyeMode = "username" | "email";

export const USERNAME_PLATFORMS: HawkEyePlatform[] = [
  "telegram",
  "tiktok",
  "instagram",
  "snapchat",
];

export const EMAIL_PLATFORMS: HawkEyePlatform[] = ["gravatar"];

/* ----------------------------------------------------------- helpers */

async function timedFetch(
  url: string,
  opts: RequestInit = {},
): Promise<Response | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...opts,
      signal: ac.signal,
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.7",
        ...(opts.headers ?? {}),
      },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extract(html: string, regex: RegExp): string | null {
  const m = html.match(regex);
  return m ? m[1]!.trim() : null;
}

/* ---------------------------------------------------------- probes */

/**
 * Telegram: t.me/<username>
 * Public profile pages render the page title and a short bio. We treat any
 * `tgme_page_title` element as a confirmed hit. Pages that 404 or strip
 * out that element fall through to "not-found".
 */
async function probeTelegram(handle: string): Promise<ProbeResult> {
  const start = Date.now();
  const url = `https://t.me/${encodeURIComponent(handle)}`;
  const res = await timedFetch(url);
  if (!res) {
    return base("telegram", "error", url, "Network timeout", start);
  }
  if (res.status === 404) {
    return base("telegram", "not-found", url, "404", start);
  }
  const html = await res.text();
  if (
    html.includes("tgme_page_title") ||
    html.includes('class="tgme_page"') ||
    html.includes("If you have Telegram")
  ) {
    const display =
      extract(html, /<meta property="og:title" content="([^"]+)"/) ??
      extract(html, /class="tgme_page_title"[^>]*>\s*<span[^>]*>([^<]+)/);
    return base("telegram", "found", url, display, start);
  }
  return base("telegram", "not-found", url, "Profile markers absent", start);
}

/**
 * TikTok: tiktok.com/@<username>
 * TikTok serves 404 for unknown handles and a profile JSON-LD blob for
 * existing ones. They sometimes throw a captcha at server-side fetches —
 * we surface that as "unclear".
 */
async function probeTiktok(handle: string): Promise<ProbeResult> {
  const start = Date.now();
  const url = `https://www.tiktok.com/@${encodeURIComponent(handle)}`;
  const res = await timedFetch(url);
  if (!res) return base("tiktok", "error", url, "Network timeout", start);
  if (res.status === 404)
    return base("tiktok", "not-found", url, "404", start);
  const html = await res.text();
  if (html.includes("Couldn&#x27;t find this account") || html.includes("user-page-not-found")) {
    return base("tiktok", "not-found", url, "Account not found", start);
  }
  if (html.includes("verify-bar") || html.includes("captcha")) {
    return base("tiktok", "unclear", url, "Captcha challenge", start);
  }
  if (html.includes('"@type":"Person"') || /uniqueId/.test(html)) {
    const display =
      extract(html, /"nickname":"([^"]+)"/) ??
      extract(html, /<title>([^<]+)<\/title>/);
    return base("tiktok", "found", url, display, start);
  }
  return base("tiktok", "unclear", url, "Ambiguous response", start);
}

/**
 * Instagram is the noisiest target — they aggressively return login walls
 * for anonymous fetches. We still extract a couple of robust signals:
 *   - the canonical 404 HTML carries "Sorry, this page isn't available"
 *   - real profiles include `<meta property="og:title" content="...@handle..."`
 * Anything else is "unclear" — probably login wall, not a real signal.
 */
async function probeInstagram(handle: string): Promise<ProbeResult> {
  const start = Date.now();
  const url = `https://www.instagram.com/${encodeURIComponent(handle)}/`;
  const res = await timedFetch(url);
  if (!res) return base("instagram", "error", url, "Network timeout", start);
  if (res.status === 404)
    return base("instagram", "not-found", url, "404", start);
  const html = await res.text();
  if (
    html.includes("Sorry, this page isn&#x27;t available") ||
    html.includes("Page Not Found")
  ) {
    return base("instagram", "not-found", url, "Page not available", start);
  }
  // Look for a profile-shaped og:title or og:description.
  const ogTitle = extract(html, /<meta property="og:title" content="([^"]+)"/);
  if (ogTitle && /@[\w.]+/i.test(ogTitle)) {
    return base("instagram", "found", url, ogTitle, start);
  }
  if (html.includes('"profilePage_') || html.includes("biography")) {
    return base("instagram", "found", url, ogTitle, start);
  }
  return base("instagram", "unclear", url, "Login wall — not conclusive", start);
}

/**
 * Snapchat: snapchat.com/add/<username>
 * Confirmed handles serve a "Hey, I'm using Snapchat — add me!" page with
 * the username inside the og:title. Unknown handles redirect to a generic
 * "create account" landing or return a 404.
 */
async function probeSnapchat(handle: string): Promise<ProbeResult> {
  const start = Date.now();
  const url = `https://www.snapchat.com/add/${encodeURIComponent(handle)}`;
  const res = await timedFetch(url);
  if (!res) return base("snapchat", "error", url, "Network timeout", start);
  if (res.status === 404)
    return base("snapchat", "not-found", url, "404", start);
  const html = await res.text();
  if (
    html.includes("Looks like that user doesn") ||
    html.includes("Account Not Found") ||
    html.includes("Snapchat couldn&#39;t find")
  ) {
    return base("snapchat", "not-found", url, "Account not found", start);
  }
  const ogTitle = extract(html, /<meta property="og:title" content="([^"]+)"/);
  if (
    ogTitle &&
    (ogTitle.toLowerCase().includes(handle.toLowerCase()) ||
      ogTitle.toLowerCase().includes("snapchat"))
  ) {
    return base("snapchat", "found", url, ogTitle, start);
  }
  return base("snapchat", "unclear", url, "Ambiguous response", start);
}

/**
 * Gravatar exposes a JSON profile keyed by lowercase MD5 of the email.
 * 200 = profile exists, 404 = no Gravatar bound.
 */
async function probeGravatar(email: string): Promise<ProbeResult> {
  const start = Date.now();
  const md5 = crypto
    .createHash("md5")
    .update(email.trim().toLowerCase())
    .digest("hex");
  const url = `https://www.gravatar.com/${md5}.json`;
  const res = await timedFetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res) return base("gravatar", "error", url, "Network timeout", start);
  if (res.status === 404)
    return base("gravatar", "not-found", url, "No Gravatar bound", start);
  if (!res.ok)
    return base("gravatar", "error", url, `HTTP ${res.status}`, start);
  try {
    const data = (await res.json()) as {
      entry?: { displayName?: string; preferredUsername?: string }[];
    };
    const entry = data.entry?.[0];
    const display = entry?.displayName ?? entry?.preferredUsername ?? null;
    return base("gravatar", "found", url, display, start);
  } catch {
    return base("gravatar", "unclear", url, "Malformed response", start);
  }
}

/* --------------------------------------------------------- dispatcher */

function base(
  platform: HawkEyePlatform,
  status: ProbeStatus,
  url: string,
  detail: string | null,
  startedAt: number,
): ProbeResult {
  return {
    platform,
    status,
    url,
    display: null,
    detail,
    durationMs: Date.now() - startedAt,
  };
}

export async function probe(
  platform: HawkEyePlatform,
  query: string,
): Promise<ProbeResult> {
  switch (platform) {
    case "telegram":
      return probeTelegram(query);
    case "tiktok":
      return probeTiktok(query);
    case "instagram":
      return probeInstagram(query);
    case "snapchat":
      return probeSnapchat(query);
    case "gravatar":
      return probeGravatar(query);
  }
}

/**
 * Light validation — refuses queries that would obviously not match any of
 * the supported platforms. Username is intentionally permissive (3-32 chars,
 * letters/digits/underscore/dot) since each platform has its own rules.
 */
export function normaliseUsername(raw: string): string | null {
  const trimmed = raw.trim().replace(/^@+/, "");
  if (trimmed.length < 3 || trimmed.length > 32) return null;
  if (!/^[A-Za-z0-9._]+$/.test(trimmed)) return null;
  return trimmed;
}

export function normaliseEmail(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) return null;
  return trimmed;
}
