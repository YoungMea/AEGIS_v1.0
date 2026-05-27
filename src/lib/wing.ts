/**
 * Wing — geographic projection of dossiers.
 *
 * Pipeline:
 *   1. Pull every dossier with at least a city or country.
 *   2. Resolve "<city>, <country>" to coordinates via Nominatim (cached).
 *   3. Cluster by location, return markers with the highest risk found.
 *
 * Privacy:
 *   - Each operative sees only their own dossiers (owner-scoped query).
 *   - The geocode cache is shared, but it stores PUBLIC place names only,
 *     never operative-specific data.
 */
import { getDb } from "./db";
import { listDossiersByOwner } from "./dossier";

const NOMINATIM = "https://nominatim.openstreetmap.org";
const USER_AGENT =
  "AEGIS-Wing/1.0 (educational; +https://github.com/YoungMea/AEGIS_v1.0)";

// Nominatim asks for ≤ 1 request/second. We batch and serialise.
const NOMINATIM_DELAY_MS = 1100;

export interface MarkerDossier {
  id: string;
  ref: string;
  fullName: string | null;
  alias: string | null;
  classification: string;
  riskLevel: string;
  status: string;
  city: string | null;
  country: string | null;
  updatedAt: number;
}

export interface WingMarker {
  query: string; // normalised cache key
  lat: number;
  lng: number;
  city: string | null;
  country: string | null;
  highestRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  count: number;
  dossiers: MarkerDossier[];
}

const RISK_RANK: Record<string, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

function pickHigher(a: string, b: string): string {
  return (RISK_RANK[a] ?? 0) > (RISK_RANK[b] ?? 0) ? a : b;
}

interface CacheRow {
  lat: number | null;
  lng: number | null;
  display_name: string | null;
}

function normalise(city: string | null, country: string | null): string {
  return [city, country]
    .filter((s): s is string => !!s && s.trim().length > 0)
    .map((s) => s.trim().toLowerCase())
    .join(", ");
}

function lookupCache(query: string): CacheRow | undefined {
  const db = getDb();
  return db
    .prepare(
      "SELECT lat, lng, display_name FROM geocode_cache WHERE query = ?",
    )
    .get(query) as CacheRow | undefined;
}

function recordCache(
  query: string,
  hit: { lat: number; lng: number; displayName: string } | null,
) {
  const db = getDb();
  const now = Date.now();
  // Even null hits are cached so we don't keep retrying unknown places.
  db.prepare(
    `INSERT INTO geocode_cache (query, lat, lng, display_name, hit_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(query) DO UPDATE SET
       lat = excluded.lat,
       lng = excluded.lng,
       display_name = excluded.display_name,
       hit_at = excluded.hit_at`,
  ).run(query, hit?.lat ?? null, hit?.lng ?? null, hit?.displayName ?? null, now, now);
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

async function geocodeOnce(
  query: string,
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  try {
    const url = new URL(`${NOMINATIM}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "0");

    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 8000);
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en",
      },
      signal: ac.signal,
    });
    clearTimeout(to);
    if (!res.ok) return null;
    const arr = (await res.json()) as NominatimResult[];
    if (!arr.length) return null;
    const lat = parseFloat(arr[0]!.lat);
    const lng = parseFloat(arr[0]!.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, displayName: arr[0]!.display_name };
  } catch {
    return null;
  }
}

async function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Build the marker set for a given user. Resolves any not-yet-cached
 * locations through Nominatim with a 1.1s delay between calls to respect
 * the upstream policy. Cached entries return instantly.
 */
export async function buildMarkers(ownerId: string): Promise<WingMarker[]> {
  const dossiers = listDossiersByOwner(ownerId);

  // Group dossiers by normalised "<city>, <country>".
  const groups = new Map<
    string,
    {
      query: string;
      city: string | null;
      country: string | null;
      dossiers: MarkerDossier[];
    }
  >();
  for (const d of dossiers) {
    const query = normalise(d.city, d.country);
    if (!query) continue; // no usable location
    const entry = groups.get(query) ?? {
      query,
      city: d.city,
      country: d.country,
      dossiers: [],
    };
    entry.dossiers.push({
      id: d.id,
      ref: `AGS-${d.id.slice(-8).toUpperCase()}`,
      fullName: d.fullName,
      alias: d.alias,
      classification: d.classification,
      riskLevel: d.riskLevel,
      status: d.status,
      city: d.city,
      country: d.country,
      updatedAt: d.updatedAt,
    });
    groups.set(query, entry);
  }

  // Resolve coordinates: cache hits first, miss queue gets serialised.
  const markers: WingMarker[] = [];
  const misses: typeof groups extends Map<string, infer V> ? V[] : never = [];

  for (const g of groups.values()) {
    const cached = lookupCache(g.query);
    if (cached && cached.lat != null && cached.lng != null) {
      markers.push(toMarker(g, cached.lat, cached.lng));
    } else if (cached && cached.lat == null) {
      // Negative cache: skip silently, we already know it doesn't resolve.
      continue;
    } else {
      misses.push(g);
    }
  }

  // Resolve uncached groups one at a time, throttled to Nominatim's policy.
  for (let i = 0; i < misses.length; i++) {
    const g = misses[i]!;
    const hit = await geocodeOnce(g.query);
    recordCache(g.query, hit);
    if (hit) markers.push(toMarker(g, hit.lat, hit.lng));
    if (i < misses.length - 1) await sleep(NOMINATIM_DELAY_MS);
  }

  // Sort markers by highest-risk first, then count, for predictable layering.
  markers.sort((a, b) => {
    const dr = (RISK_RANK[b.highestRisk] ?? 0) - (RISK_RANK[a.highestRisk] ?? 0);
    if (dr !== 0) return dr;
    return b.count - a.count;
  });
  return markers;
}

function toMarker(
  g: {
    query: string;
    city: string | null;
    country: string | null;
    dossiers: MarkerDossier[];
  },
  lat: number,
  lng: number,
): WingMarker {
  const highest = g.dossiers.reduce<string>(
    (acc, d) => pickHigher(acc, d.riskLevel),
    "LOW",
  ) as WingMarker["highestRisk"];
  return {
    query: g.query,
    lat,
    lng,
    city: g.city,
    country: g.country,
    highestRisk: highest,
    count: g.dossiers.length,
    dossiers: g.dossiers,
  };
}
