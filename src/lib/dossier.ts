/**
 * Dossier data access layer.
 */
import { getDb } from "./db";
import { cuid } from "./ids";
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
  riskLevel: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

function parseJson<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function rowToDossier(r: DossierRow): Dossier {
  return {
    id: r.id,
    ownerId: r.owner_id,
    classification: r.classification,
    status: r.status,
    targetImage: r.target_image,
    fullName: r.full_name,
    alias: r.alias,
    phone: r.phone,
    email: r.email,
    country: r.country,
    city: r.city,
    address: r.address,
    socialMedia: parseJson<string[]>(r.social_media, []),
    knownAccounts: parseJson<string[]>(r.known_accounts, []),
    notes: r.notes,
    investigationSummary: r.investigation_summary,
    activityTimeline: parseJson<{ date: string; event: string }[]>(
      r.activity_timeline,
      [],
    ),
    connections: parseJson<{ name: string; relation: string }[]>(
      r.connections,
      [],
    ),
    additionalEvidence: r.additional_evidence,
    riskLevel: r.risk_level,
    tags: parseJson<string[]>(r.tags, []),
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
  db.prepare(
    `INSERT INTO dossiers (
        id, owner_id, classification, status, target_image,
        full_name, alias, phone, email, country, city, address,
        social_media, known_accounts, notes, investigation_summary,
        activity_timeline, connections, additional_evidence,
        risk_level, tags, created_at, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    ownerId,
    input.classification,
    input.status,
    input.targetImage ?? null,
    input.fullName ?? null,
    input.alias ?? null,
    input.phone ?? null,
    input.email ?? null,
    input.country ?? null,
    input.city ?? null,
    input.address ?? null,
    JSON.stringify(input.socialMedia ?? []),
    JSON.stringify(input.knownAccounts ?? []),
    input.notes ?? null,
    input.investigationSummary ?? null,
    JSON.stringify(input.activityTimeline ?? []),
    JSON.stringify(input.connections ?? []),
    input.additionalEvidence ?? null,
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
  db.prepare(
    `UPDATE dossiers SET
        classification = ?, status = ?, target_image = ?,
        full_name = ?, alias = ?, phone = ?, email = ?, country = ?, city = ?, address = ?,
        social_media = ?, known_accounts = ?, notes = ?, investigation_summary = ?,
        activity_timeline = ?, connections = ?, additional_evidence = ?,
        risk_level = ?, tags = ?, updated_at = ?
     WHERE id = ? AND owner_id = ?`,
  ).run(
    input.classification,
    input.status,
    input.targetImage ?? null,
    input.fullName ?? null,
    input.alias ?? null,
    input.phone ?? null,
    input.email ?? null,
    input.country ?? null,
    input.city ?? null,
    input.address ?? null,
    JSON.stringify(input.socialMedia ?? []),
    JSON.stringify(input.knownAccounts ?? []),
    input.notes ?? null,
    input.investigationSummary ?? null,
    JSON.stringify(input.activityTimeline ?? []),
    JSON.stringify(input.connections ?? []),
    input.additionalEvidence ?? null,
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
