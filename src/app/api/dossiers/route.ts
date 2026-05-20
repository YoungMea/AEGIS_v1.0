/**
 * GET  /api/dossiers       — list dossiers for current user
 * POST /api/dossiers       — create a new dossier
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk, safeJson, fromZod } from "@/lib/api";
import { dossierSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth";
import {
  createDossier,
  listDossiersByOwner,
} from "@/lib/dossier";
import { ZodError } from "zod";

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return jsonError("Unauthorized", 401);
  }
  const dossiers = listDossiersByOwner(user.id);
  return jsonOk({ dossiers });
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return jsonError("Unauthorized", 401);
  }

  const body = await safeJson(req);
  let parsed;
  try {
    parsed = dossierSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) return jsonError("Invalid input", 400, fromZod(e));
    return jsonError("Invalid input");
  }

  const dossier = createDossier(user.id, parsed);
  return jsonOk({ dossier }, 201);
}
