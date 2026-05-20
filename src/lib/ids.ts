/**
 * ID generation helpers.
 *  - cuid-like compact ID for primary keys
 *  - secure numeric UID for users (8 digits, never starts with 0)
 */
import { randomBytes, randomInt } from "node:crypto";

export function cuid(): string {
  return (
    "c" +
    Date.now().toString(36) +
    randomBytes(8).toString("hex").slice(0, 12)
  );
}

/** 8-digit numeric UID, e.g. 58219471. First digit is 1–9. */
export function generateUID(): string {
  const first = randomInt(1, 10).toString();
  let rest = "";
  for (let i = 0; i < 7; i++) rest += randomInt(0, 10).toString();
  return first + rest;
}
