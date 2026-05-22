/**
 * Dossier data access layer with NoLook encryption.
 *
 * The following columns hold sensitive intel and are encrypted at rest:
 *   phone, email, address, social_media, known_accounts, notes,
 *   investigation_summary, activity_timeline, connections,
 *   additional_evidence, target_image
 *
 * `full_name`, `alias`, `country`, `city`, `tags`, `classification`,
 * `status`, `risk_level`, `created_at`, `updated_at` stay in plaintext to
 * keep listing/search fast. None of them is by itself usable to identify a
 * specific subject without the encrypted fields.
 *
 * AAD is bound to the dossier id so a stolen ciphertext can't be remapped
 * to a different row.
 */
import { getDb } from "./db";
import { cuid } from "./ids";
import {
  encryptJson,
  decryptJson,
  encryptNullable,
  decryptNullable,
} from "./noLook";
import type { DossierInput } from "./validation";

export interface DossierRow {
  id: string;
  owner_id: string;
  classification: string;
  status: string;
  target_image: string | null;
  full_name: string | null;
  alias: string | null;
  phone: string | null;
  email: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  social_media: string | null;
  known_accounts: string | null;
  notes: string | null;
  investigation_summary: string | null;
  activity_timeline: string | null;
  connections: string | null;
  additional_evidence: string | null;
  evidence_images: string | null;
  risk_level: string;
  tags: string | null;
  created_at: number;
  updated_at: number;
}

export interface Dossier {
  id: string;
  ownerId: string;
  classification: string;
  status: string;
  targetImage: string | null;
  fullName: string | null;
  alias: string | null;
  phone: string | null;
  email: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  socialMedia: string[];
  knownAccounts: string[];
  notes: string | null;
  investigationSummary: string | null;
  activityTimeline: { date: string; event: string }[];
  connections: { name: string; relation: string }[];
  additionalEvidence: string | null;
  evidenceImages: string[];
  riskLevel: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

function aadFor(id: string) {
  return `dossier:${id}`;
}

function parseTagsOrLegacy(s: string | null): string[] {
  if (!s) return [];
  try {
    return JSON.parse(s) as string[];
  } catch {
    return [];
  }
}

export function rowToDossier(r: DossierRow): Dossier {
  const aad = aadFor(r.id);
  return {
    id: r.id,
    ownerId: r.owner_id,
    classification: r.classification,
    status: r.status,
    targetImage: decryptNullable(r.target_image, aad),
    fullName: r.full_name,
    alias: r.alias,
    phone: decryptNullable(r.phone, aad),
    email: decryptNullable(r.email, aad),
    country: r.country,
    city: r.city,
    address: decryptNullable(r.address, aad),
    socialMedia:
      decryptJson<string[]>(r.social_media ?? "", aad) ?? [],
    knownAccounts:
      decryptJson<string[]>(r.known_accounts ?? "", aad) ?? [],
    notes: decryptNullable(r.notes, aad),
    investigationSummary: decryptNullable(r.investigation_summary, aad),
    activityTimeline:
      decryptJson<{ date: string; event: string }[]>(
        r.activity_timeline ?? "",
        aad,
      ) ?? [],
    connections:
      decryptJson<{ name: string; relation: string }[]>(
        r.connections ?? "",
        aad,
      ) ?? [],
    additionalEvidence: decryptNullable(r.additional_evidence, aad),
    evidenceImages:
      decryptJson<string[]>(r.evidence_images ?? "", aad) ?? [],
    riskLevel: r.risk_level,
    tags: parseTagsOrLegacy(r.tags),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listDossiersByOwner(ownerId: string): Dossier[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM dossiers WHERE owner_id = ? ORDER BY updated_at DESC",
    )
    .all(ownerId) as DossierRow[];
  return rows.map(rowToDossier);
}

export function getDossier(id: string, ownerId: string): Dossier | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM dossiers WHERE id = ? AND owner_id = ?")
    .get(id, ownerId) as DossierRow | undefined;
  return row ? rowToDossier(row) : null;
}

export function createDossier(ownerId: string, input: DossierInput): Dossier {
  const db = getDb();
  const id = cuid();
  const now = Date.now();
  const aad = aadFor(id);

  db.prepare(
    `INSERT INTO dossiers (
        id, owner_id, classification, status, target_image,
        full_name, alias, phone, email, country, city, address,
        social_media, known_accounts, notes, investigation_summary,
        activity_timeline, connections, additional_evidence, evidence_images,
        risk_level, tags, created_at, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    ownerId,
    input.classification,
    input.status,
    encryptNullable(input.targetImage ?? null, aad),
    input.fullName ?? null,
    input.alias ?? null,
    encryptNullable(input.phone ?? null, aad),
    encryptNullable(input.email ?? null, aad),
    input.country ?? null,
    input.city ?? null,
    encryptNullable(input.address ?? null, aad),
    encryptJson(input.socialMedia ?? [], aad),
    encryptJson(input.knownAccounts ?? [], aad),
    encryptNullable(input.notes ?? null, aad),
    encryptNullable(input.investigationSummary ?? null, aad),
    encryptJson(input.activityTimeline ?? [], aad),
    encryptJson(input.connections ?? [], aad),
    encryptNullable(input.additionalEvidence ?? null, aad),
    encryptJson(input.evidenceImages ?? [], aad),
    input.riskLevel,
    JSON.stringify(input.tags ?? []),
    now,
    now,
  );
  return getDossier(id, ownerId)!;
}

export function updateDossier(
  id: string,
  ownerId: string,
  input: DossierInput,
): Dossier | null {
  const db = getDb();
  const existing = getDossier(id, ownerId);
  if (!existing) return null;
  const now = Date.now();
  const aad = aadFor(id);

  db.prepare(
    `UPDATE dossiers SET
        classification = ?, status = ?, target_image = ?,
        full_name = ?, alias = ?, phone = ?, email = ?, country = ?, city = ?, address = ?,
        social_media = ?, known_accounts = ?, notes = ?, investigation_summary = ?,
        activity_timeline = ?, connections = ?, additional_evidence = ?, evidence_images = ?,
        risk_level = ?, tags = ?, updated_at = ?
     WHERE id = ? AND owner_id = ?`,
  ).run(
    input.classification,
    input.status,
    encryptNullable(input.targetImage ?? null, aad),
    input.fullName ?? null,
    input.alias ?? null,
    encryptNullable(input.phone ?? null, aad),
    encryptNullable(input.email ?? null, aad),
    input.country ?? null,
    input.city ?? null,
    encryptNullable(input.address ?? null, aad),
    encryptJson(input.socialMedia ?? [], aad),
    encryptJson(input.knownAccounts ?? [], aad),
    encryptNullable(input.notes ?? null, aad),
    encryptNullable(input.investigationSummary ?? null, aad),
    encryptJson(input.activityTimeline ?? [], aad),
    encryptJson(input.connections ?? [], aad),
    encryptNullable(input.additionalEvidence ?? null, aad),
    encryptJson(input.evidenceImages ?? [], aad),
    input.riskLevel,
    JSON.stringify(input.tags ?? []),
    now,
    id,
    ownerId,
  );
  return getDossier(id, ownerId);
}

export function deleteDossier(id: string, ownerId: string): boolean {
  const db = getDb();
  const r = db
    .prepare("DELETE FROM dossiers WHERE id = ? AND owner_id = ?")
    .run(id, ownerId);
  return r.changes > 0;
}
