/**
 * HawkEye — username / email / phone reconnaissance.
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
  display: string | null; // profile name pulled from page (or username)
  detail: string | null;  // human-readable hint, e.g. "Login wall"
  durationMs: number;
}

export type HawkEyePlatform =
  | "telegram"
  | "tiktok"
  | "instagram"
  | "snapchat"
  | "blink"
  | "gravatar"
  | "github"
  | "whatsapp"
  | "telegramPhone"
  | "blinkPhone"
  | "viber"
  | "signal";

export type HawkEyeMode = "username" | "email" | "phone";

export const USERNAME_PLATFORMS: HawkEyePlatform[] = [
  "telegram",
  "tiktok",
  "instagram",
  "snapchat",
  "blink",
  "github",
];

export const EMAIL_PLATFORMS: HawkEyePlatform[] = ["gravatar", "github"];

export const PHONE_PLATFORMS: HawkEyePlatform[] = [
  "whatsapp",
  "telegramPhone",
  "viber",
  "signal",
  "blinkPhone",
];

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
    clearTimeout(timer);
  }
}

function extract(html: string, regex: RegExp): string | null {
  const m = html.match(regex);
  return m ? m[1]!.trim() : null;
}

function base(
  platform: HawkEyePlatform,
  status: ProbeStatus,
  url: string,
  detail: string | null,
  startedAt: number,
  display: string | null = null,
): ProbeResult {
  return {
    platform,
    status,
    url,
    display,
    detail,
    durationMs: Date.now() - startedAt,
  };
}

/* ---------------------------------------------------------- probes */

/**
 * Telegram: t.me/<username>
 */
async function probeTelegram(handle: string): Promise<ProbeResult> {
  const start = Date.now();
  const url = `https://t.me/${encodeURIComponent(handle)}`;
  const res = await timedFetch(url);
  if (!res) return base("telegram", "error", url, "Network timeout", start);
  if (res.status === 404)
    return base("telegram", "not-found", url, "404", start);
  const html = await res.text();
  if (
    html.includes("tgme_page_title") ||
    html.includes('class="tgme_page"') ||
    html.includes("If you have Telegram")
  ) {
    const display =
      extract(html, /<meta property="og:title" content="([^"]+)"/) ??
      extract(html, /class="tgme_page_title"[^>]*>\s*<span[^>]*>([^<]+)/);
    return base("telegram", "found", url, "Profile reachable", start, display);
  }
  return base("telegram", "not-found", url, "Profile markers absent", start);
}

/**
 * TikTok: tiktok.com/@<username>
 */
async function probeTiktok(handle: string): Promise<ProbeResult> {
  const start = Date.now();
  const url = `https://www.tiktok.com/@${encodeURIComponent(handle)}`;
  const res = await timedFetch(url);
  if (!res) return base("tiktok", "error", url, "Network timeout", start);
  if (res.status === 404)
    return base("tiktok", "not-found", url, "404", start);
  const html = await res.text();
  if (
    html.includes("Couldn&#x27;t find this account") ||
    html.includes("user-page-not-found")
  ) {
    return base("tiktok", "not-found", url, "Account not found", start);
  }
  if (html.includes("verify-bar") || html.includes("captcha")) {
    return base("tiktok", "unclear", url, "Captcha challenge", start);
  }
  if (html.includes('"@type":"Person"') || /uniqueId/.test(html)) {
    const display =
      extract(html, /"nickname":"([^"]+)"/) ??
      extract(html, /<title>([^<]+)<\/title>/);
    return base("tiktok", "found", url, "Profile JSON-LD present", start, display);
  }
  return base("tiktok", "unclear", url, "Ambiguous response", start);
}

/**
 * Instagram: instagram.com/<handle>
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
  const ogTitle = extract(html, /<meta property="og:title" content="([^"]+)"/);
  if (ogTitle && /@[\w.]+/i.test(ogTitle)) {
    return base("instagram", "found", url, "OG profile metadata", start, ogTitle);
  }
  if (html.includes('"profilePage_') || html.includes("biography")) {
    return base("instagram", "found", url, "Profile markers present", start, ogTitle);
  }
  return base(
    "instagram",
    "unclear",
    url,
    "Login wall — not conclusive",
    start,
  );
}

/**
 * Snapchat: snapchat.com/add/<username>
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
    return base("snapchat", "found", url, "OG profile metadata", start, ogTitle);
  }
  return base("snapchat", "unclear", url, "Ambiguous response", start);
}

/**
 * Blink (blinkmap.com) — friends-on-a-map social. Best-effort probe.
 */
async function probeBlink(handle: string): Promise<ProbeResult> {
  const start = Date.now();
  const url = `https://blinkmap.com/en/u/${encodeURIComponent(handle)}`;
  const res = await timedFetch(url, { redirect: "manual" });
  if (!res) return base("blink", "error", url, "Network timeout", start);

  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location") ?? "";
    if (loc.includes("__nuxt_error") || loc.includes("statusCode=404")) {
      return base("blink", "not-found", url, "Profile not found", start);
    }
  }
  if (res.status === 404)
    return base("blink", "not-found", url, "404", start);
  if (!res.ok)
    return base("blink", "unclear", url, `HTTP ${res.status}`, start);

  const html = await res.text();
  if (
    html.includes("__nuxt_error") ||
    html.includes("Page not found") ||
    html.includes("statusCode=404")
  ) {
    return base("blink", "not-found", url, "Profile not found", start);
  }
  const ogTitle = extract(html, /<meta property="og:title" content="([^"]+)"/);
  return base(
    "blink",
    "found",
    url,
    "Profile reachable",
    start,
    ogTitle ?? `@${handle} on Blink`,
  );
}

/**
 * GitHub — handles both modes:
 *   - email lookup via search API (returns bound username if email is public)
 *   - username lookup via /users/<handle>
 *
 * Set `GITHUB_TOKEN` env to lift the unauth quota (60/h) to 5000/h.
 */
async function probeGithub(query: string): Promise<ProbeResult> {
  const start = Date.now();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  if (query.includes("@")) {
    // Email path — search users in:email
    const apiUrl = `https://api.github.com/search/users?q=${encodeURIComponent(
      `${query} in:email`,
    )}`;
    const res = await timedFetch(apiUrl, { headers });
    if (!res) return base("github", "error", apiUrl, "Network timeout", start);
    if (res.status === 403) {
      return base(
        "github",
        "error",
        apiUrl,
        "Rate limited · set GITHUB_TOKEN env",
        start,
      );
    }
    if (!res.ok) {
      return base("github", "error", apiUrl, `HTTP ${res.status}`, start);
    }
    try {
      const data = (await res.json()) as {
        total_count: number;
        items?: { login: string; html_url: string }[];
      };
      if (!data.total_count || !data.items?.length) {
        return base(
          "github",
          "not-found",
          apiUrl,
          "No GitHub account bound to this email",
          start,
        );
      }
      const hit = data.items[0]!;
      const more =
        data.total_count > 1 ? ` (+${data.total_count - 1} more)` : "";
      return base(
        "github",
        "found",
        hit.html_url,
        `Username @${hit.login}${more}`,
        start,
        hit.login,
      );
    } catch {
      return base("github", "unclear", apiUrl, "Malformed response", start);
    }
  }

  // Username path
  const apiUrl = `https://api.github.com/users/${encodeURIComponent(query)}`;
  const profileUrl = `https://github.com/${encodeURIComponent(query)}`;
  const res = await timedFetch(apiUrl, { headers });
  if (!res)
    return base("github", "error", profileUrl, "Network timeout", start);
  if (res.status === 404) {
    return base("github", "not-found", profileUrl, "No such GitHub user", start);
  }
  if (res.status === 403) {
    return base(
      "github",
      "error",
      profileUrl,
      "Rate limited · set GITHUB_TOKEN env",
      start,
    );
  }
  if (!res.ok) {
    return base("github", "error", profileUrl, `HTTP ${res.status}`, start);
  }
  try {
    const data = (await res.json()) as {
      login: string;
      name: string | null;
      bio: string | null;
      html_url: string;
    };
    return base(
      "github",
      "found",
      data.html_url,
      data.bio ?? "GitHub profile reachable",
      start,
      data.name ?? data.login,
    );
  } catch {
    return base("github", "unclear", profileUrl, "Malformed response", start);
  }
}

/* ---------------------------- phone mode probes */

/**
 * WhatsApp click-to-chat (wa.me/<phone>).
 */
async function probeWhatsapp(phone: string): Promise<ProbeResult> {
  const start = Date.now();
  const digits = phone.replace(/\D/g, "");
  const url = `https://wa.me/${digits}`;
  const res = await timedFetch(url);
  if (!res) return base("whatsapp", "error", url, "Network timeout", start);
  if (!res.ok)
    return base("whatsapp", "error", url, `HTTP ${res.status}`, start);
  const html = await res.text();
  if (
    html.includes("Phone number shared via url is invalid") ||
    html.includes("invalid_phone_number")
  ) {
    return base("whatsapp", "not-found", url, "Invalid number", start);
  }
  if (html.includes("Share on WhatsApp") || html.includes("type=phone_number")) {
    return base(
      "whatsapp",
      "unclear",
      url,
      "Deep-link valid · open in WhatsApp to confirm",
      start,
    );
  }
  return base("whatsapp", "unclear", url, "Ambiguous response", start);
}

/**
 * Telegram phone lookup (t.me/+<phone>).
 */
async function probeTelegramPhone(phone: string): Promise<ProbeResult> {
  const start = Date.now();
  const digits = phone.replace(/\D/g, "");
  const url = `https://t.me/+${digits}`;
  const res = await timedFetch(url);
  if (!res)
    return base("telegramPhone", "error", url, "Network timeout", start);
  if (res.status === 404)
    return base("telegramPhone", "not-found", url, "404", start);
  const html = await res.text();
  if (
    html.includes("Phone number is invalid") ||
    html.includes("phone_number_invalid")
  ) {
    return base("telegramPhone", "not-found", url, "Invalid number", start);
  }
  if (
    html.includes("tgme_page_title") ||
    html.includes("If you have Telegram") ||
    html.includes("Join group chat on Telegram")
  ) {
    return base(
      "telegramPhone",
      "unclear",
      url,
      "Deep-link valid · open in Telegram to confirm",
      start,
    );
  }
  return base("telegramPhone", "unclear", url, "Ambiguous response", start);
}

/**
 * Blink phone — app-only directory, deep-link only.
 */
async function probeBlinkPhone(phone: string): Promise<ProbeResult> {
  const start = Date.now();
  const digits = phone.replace(/\D/g, "");
  const url = `https://blinkmap.com/en?invite=${digits}`;
  return base(
    "blinkPhone",
    "unclear",
    url,
    "App-only directory · open Blink and search contacts to confirm",
    start,
  );
}

/**
 * Viber click-to-chat — deep-link only.
 */
async function probeViber(phone: string): Promise<ProbeResult> {
  const start = Date.now();
  const digits = phone.replace(/\D/g, "");
  const url = `viber://chat?number=%2B${digits}`;
  return base(
    "viber",
    "unclear",
    url,
    "Deep-link only · open Viber to confirm",
    start,
  );
}

/**
 * Signal — deep-link only.
 */
async function probeSignal(phone: string): Promise<ProbeResult> {
  const start = Date.now();
  const digits = phone.replace(/\D/g, "");
  const url = `https://signal.me/#p/+${digits}`;
  return base(
    "signal",
    "unclear",
    url,
    "Deep-link only · open Signal to confirm",
    start,
  );
}

/**
 * Gravatar — JSON profile keyed by md5(lowercase email). Returns the
 * Gravatar display name and (when set) the bound username.
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
    return base(
      "gravatar",
      "found",
      url,
      "Gravatar profile bound to email",
      start,
      display,
    );
  } catch {
    return base("gravatar", "unclear", url, "Malformed response", start);
  }
}

/* --------------------------------------------------------- dispatcher */

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
    case "blink":
      return probeBlink(query);
    case "github":
      return probeGithub(query);
    case "gravatar":
      return probeGravatar(query);
    case "whatsapp":
      return probeWhatsapp(query);
    case "telegramPhone":
      return probeTelegramPhone(query);
    case "blinkPhone":
      return probeBlinkPhone(query);
    case "viber":
      return probeViber(query);
    case "signal":
      return probeSignal(query);
  }
}

/* ------------------------------------------------------- input helpers */

/**
 * Light validation — refuses queries that would obviously not match any
 * of the supported platforms. Username is intentionally permissive
 * (3-32 chars, letters/digits/underscore/dot) since each platform has
 * its own rules.
 */
export function normaliseUsername(raw: string): string | null {
  const trimmed = raw.trim().replace(/^@+/, "");
  if (trimmed.length < 3 || trimmed.length > 32) return null;
  if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) return null;
  return trimmed;
}

export function normaliseEmail(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Phone normalisation — strips spaces, dashes, parentheses and a leading
 * "+", then validates the remaining digits as an E.164-style international
 * number. Accepts 7-15 digits, with the country code prefix present.
 */
export function normalisePhone(raw: string): string | null {
  const cleaned = raw.replace(/[^\d+]/g, "");
  const digits = cleaned.replace(/^\+/, "").replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return digits;
}
