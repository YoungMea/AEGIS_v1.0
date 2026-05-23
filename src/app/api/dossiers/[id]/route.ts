/**
 * GET    /api/dossiers/:id
 * PUT    /api/dossiers/:id
 * DELETE /api/dossiers/:id
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk, safeJson, fromZod } from "@/lib/api";
import { dossierSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth";
import {
  deleteDossier,
  getDossier,
  updateDossier,
} from "@/lib/dossier";
import { record } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { ZodError } from "zod";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return jsonError("Unauthorized", 401);
  }
  const { id } = await ctx.params;
  const dossier = getDossier(id, user.id);
  if (!dossier) return jsonError("Not found", 404);
  record({
    userId: user.id,
    action: "dossier.viewed",
    targetType: "dossier",
    targetId: dossier.id,
    summary: dossier.fullName ?? "Untitled subject",
    ip: clientIp(req),
  });
  return jsonOk({ dossier });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return jsonError("Unauthorized", 401);
  }
  const { id } = await ctx.params;
  const body = await safeJson(req);
  let parsed;
  try {
    parsed = dossierSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) return jsonError("Invalid input", 400, fromZod(e));
    return jsonError("Invalid input");
  }
  const dossier = updateDossier(id, user.id, parsed);
  if (!dossier) return jsonError("Not found", 404);
  record({
    userId: user.id,
    action: "dossier.updated",
    targetType: "dossier",
    targetId: dossier.id,
    summary: dossier.fullName ?? "Untitled subject",
    ip: clientIp(req),
  });
  return jsonOk({ dossier });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return jsonError("Unauthorized", 401);
  }
  const { id } = await ctx.params;
  const ok = deleteDossier(id, user.id);
  if (!ok) return jsonError("Not found", 404);
  record({
    userId: user.id,
    action: "dossier.deleted",
    targetType: "dossier",
    targetId: id,
    summary: `Dossier ${id.slice(-8).toUpperCase()}`,
    ip: clientIp(req),
  });
  return jsonOk({ ok: true });
}
