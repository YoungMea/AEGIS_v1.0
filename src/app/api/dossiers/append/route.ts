/**
 * POST /api/dossiers/append
 * Body: {
 *   dossierId: string,
 *   links?: string[],          // appended to socialMedia
 *   imageUrls?: string[],      // downloaded server-side -> evidenceImages
 *   summary?: string,          // appended to additionalEvidence
 *   tags?: string[]            // merged into tags
 * }
 *
 * Used by EagleEye to file its findings straight into an existing dossier
 * with a single click. The server downloads each image URL and converts
 * it to a data URL so the dossier stays self-contained — Render free
 * tier filesystem is ephemeral, so external image URLs would silently
 * break after a backup/restore cycle.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk, safeJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getDossier, updateDossier } from "@/lib/dossier";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_IMAGE_BYTES = 4_500_000; // ~3.4 MB raw → ~4.5 MB base64
const MAX_TOTAL_IMAGES = 10; // hard cap from dossierSchema

interface Body {
  dossierId?: string;
  links?: string[];
  imageUrls?: string[];
  summary?: string;
  tags?: string[];
}

async function downloadAsDataUrl(url: string): Promise<string | null> {
  if (!url || !url.startsWith("http")) return null;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 12_000);
    const res = await fetch(url, {
      signal: ac.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_IMAGE_BYTES) return null;
    const base64 = Buffer.from(buf).toString("base64");
    return `data:${ct};base64,${base64}`;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return jsonError("Unauthorized", 401);
  }

  if (
    !rateLimit({
      bucket: "dossiers:append:user",
      key: user.id,
      limit: 12,
      windowSec: 60,
    }).allowed
  ) {
    return jsonError("Slow down", 429);
  }

  const body = (await safeJson<Body>(req)) ?? {};
  if (!body.dossierId || typeof body.dossierId !== "string") {
    return jsonError("Missing dossierId", 400);
  }

  const dossier = getDossier(body.dossierId, user.id);
  if (!dossier) {
    return jsonError("Dossier not found", 404);
  }

  // Merge links into socialMedia (deduped, capped at 200 to keep the row reasonable).
  const incomingLinks = Array.isArray(body.links)
    ? body.links.filter((s): s is string => typeof s === "string" && s.length > 0)
    : [];
  const mergedSocial = Array.from(
    new Set([...dossier.socialMedia, ...incomingLinks]),
  ).slice(0, 200);

  // Merge tags.
  const incomingTags = Array.isArray(body.tags)
    ? body.tags.filter(
        (s): s is string => typeof s === "string" && s.length > 0 && s.length <= 40,
      )
    : [];
  const mergedTags = Array.from(
    new Set([...dossier.tags, ...incomingTags]),
  ).slice(0, 40);

  // Append summary into additionalEvidence.
  let additionalEvidence = dossier.additionalEvidence ?? "";
  if (body.summary && typeof body.summary === "string") {
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const block = `\n\n— HawkEye · ${stamp} —\n${body.summary.trim()}`;
    additionalEvidence = (additionalEvidence + block).slice(0, 8000);
  }

  // Pull image URLs server-side and convert to data URLs.
  const incomingImages = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter(
        (s): s is string => typeof s === "string" && s.startsWith("http"),
      )
    : [];
  const slots = Math.max(0, MAX_TOTAL_IMAGES - dossier.evidenceImages.length);
  const fetchedImages: string[] = [];
  for (const u of incomingImages.slice(0, slots)) {
    const d = await downloadAsDataUrl(u);
    if (d) fetchedImages.push(d);
  }
  const mergedImages = [...dossier.evidenceImages, ...fetchedImages].slice(
    0,
    MAX_TOTAL_IMAGES,
  );

  const updated = updateDossier(body.dossierId, user.id, {
    classification: dossier.classification as
      | "UNCLASSIFIED"
      | "CONFIDENTIAL"
      | "SECRET"
      | "TOP SECRET",
    status: dossier.status as "ACTIVE" | "ARCHIVED" | "PENDING" | "CLOSED",
    targetImage: dossier.targetImage,
    fullName: dossier.fullName,
    alias: dossier.alias,
    phone: dossier.phone,
    email: dossier.email,
    country: dossier.country,
    city: dossier.city,
    address: dossier.address,
    socialMedia: mergedSocial,
    knownAccounts: dossier.knownAccounts,
    notes: dossier.notes,
    investigationSummary: dossier.investigationSummary,
    activityTimeline: dossier.activityTimeline,
    connections: dossier.connections,
    additionalEvidence: additionalEvidence || null,
    evidenceImages: mergedImages,
    riskLevel: dossier.riskLevel as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    tags: mergedTags,
  });

  return jsonOk({
    dossier: updated,
    appended: {
      links: incomingLinks.length,
      images: fetchedImages.length,
      tags: incomingTags.length,
      summaryAdded: !!body.summary,
    },
  });
}
