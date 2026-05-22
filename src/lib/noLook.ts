/**
 * NoLook — application-layer encryption for sensitive data at rest.
 *
 * Threat model:
 *   • Database file leak (SQLite copy, Render container compromise, backups
 *     ending up in a public S3 bucket, …).
 *   • An employee of the hosting provider with read access to the disk.
 *   • A malicious tool dumping the DB to inspect contents.
 *
 * What NoLook does NOT protect against:
 *   • A full server compromise where the JWT_SECRET is also leaked, since
 *     the master key is derived from JWT_SECRET. (To raise the bar further,
 *     supply a separate NOLOOK_KEY env var — see below.)
 *   • Any attack against an authenticated session (account takeover).
 *
 * Implementation:
 *   • AES-256-GCM, 96-bit random IV, 128-bit auth tag.
 *   • Key derived once via scrypt from NOLOOK_KEY (or JWT_SECRET as fallback).
 *   • Output format: "nlk1:" + base64url(IV ‖ TAG ‖ CIPHERTEXT).
 *   • Backwards compatible: anything without the prefix is returned as-is on
 *     decrypt, so legacy plaintext rows aren't broken.
 *   • Optional Additional Authenticated Data (AAD) per record (e.g. dossier
 *     id) so a stolen ciphertext can't be moved between rows.
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { env } from "./env";

const PREFIX = "nlk1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const material =
    process.env.NOLOOK_KEY && process.env.NOLOOK_KEY.length > 0
      ? process.env.NOLOOK_KEY
      : env.JWT_SECRET;
  // scrypt is intentionally slow; we cache the result so this only runs once.
  cachedKey = scryptSync(material, "aegis-nolook-v1", 32);
  return cachedKey;
}

export function isCipher(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptString(plain: string, aad?: string): string {
  if (plain == null) return plain;
  if (plain === "") return "";
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  if (aad) cipher.setAAD(Buffer.from(aad, "utf8"));
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptString(payload: string, aad?: string): string {
  if (!payload) return payload;
  if (!isCipher(payload)) return payload; // legacy plaintext
  const buf = Buffer.from(payload.slice(PREFIX.length), "base64url");
  if (buf.length < IV_BYTES + TAG_BYTES) return "";
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const enc = buf.subarray(IV_BYTES + TAG_BYTES);
  try {
    const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
    if (aad) decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    // Tampered ciphertext or wrong key — fail closed.
    return "";
  }
}

/** Convenience helpers for nullable strings. */
export function encryptNullable(plain: string | null, aad?: string): string | null {
  if (plain === null || plain === undefined) return null;
  if (plain === "") return null;
  return encryptString(plain, aad);
}

export function decryptNullable(payload: string | null, aad?: string): string | null {
  if (payload === null || payload === undefined) return null;
  if (payload === "") return null;
  return decryptString(payload, aad);
}

/** Encrypt arbitrary JSON. */
export function encryptJson<T>(value: T, aad?: string): string {
  return encryptString(JSON.stringify(value), aad);
}

export function decryptJson<T>(payload: string, aad?: string): T | null {
  const txt = decryptString(payload, aad);
  if (!txt) return null;
  try {
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}
