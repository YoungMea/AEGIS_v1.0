/**
 * Authentication utilities.
 *  - Password hashing (bcrypt)
 *  - JWT signing/verification
 *  - Cookie helpers for Next.js (httpOnly, SameSite=Lax)
 *  - Session resolver for API routes & server components
 */
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { env } from "./env";
import { getDb } from "./db";
import { SESSION_COOKIE } from "./constants";

export { SESSION_COOKIE };

export interface JwtPayload {
  sub: string;        // user.id
  uid: string;        // user.uid (numeric)
  iat?: number;
  exp?: number;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signSession(payload: { sub: string; uid: string }): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function verifySession(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export interface SessionUser {
  id: string;
  uid: string;
  phone: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: number;
}

/**
 * Get the active user from the session cookie. Returns null if unauthenticated.
 */
export async function getSessionUser(
  req?: NextRequest,
): Promise<SessionUser | null> {
  let token: string | undefined;
  if (req) {
    token = req.cookies.get(SESSION_COOKIE)?.value;
  } else {
    const store = await cookies();
    token = store.get(SESSION_COOKIE)?.value;
  }
  if (!token) return null;

  const payload = verifySession(token);
  if (!payload) return null;

  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, uid, phone, display_name, avatar_url, bio, created_at FROM users WHERE id = ?",
    )
    .get(payload.sub) as SessionUser | undefined;

  return row ?? null;
}

export async function requireUser(req?: NextRequest): Promise<SessionUser> {
  const user = await getSessionUser(req);
  if (!user) {
    const err = new Error("UNAUTHORIZED");
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
  return user;
}
