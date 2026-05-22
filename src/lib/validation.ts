/**
 * Zod schemas for request validation.
 */
import { z } from "zod";

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s\-()]{6,20}$/, "Invalid phone number")
  .transform((v) => v.replace(/[^\d+]/g, ""));

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password too long")
  .refine((v) => /[A-Z]/.test(v), "Must contain an uppercase letter")
  .refine((v) => /[a-z]/.test(v), "Must contain a lowercase letter")
  .refine((v) => /[0-9]/.test(v), "Must contain a digit");

export const uidSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{6,12}$/, "UID must be numeric (6–12 digits)");

export const otpStartSchema = z.object({
  phone: phoneSchema,
});

export const otpVerifySchema = z.object({
  sessionId: z.string().min(8),
  code: z.string().regex(/^[0-9]+$/, "OTP must be numeric"),
});

export const finalizeRegistrationSchema = z.object({
  sessionId: z.string().min(8),
  password: passwordSchema,
  displayName: z.string().trim().max(80).optional(),
});

export const loginSchema = z.object({
  uid: uidSchema,
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const dossierSchema = z.object({
  classification: z
    .enum(["UNCLASSIFIED", "CONFIDENTIAL", "SECRET", "TOP SECRET"])
    .default("CONFIDENTIAL"),
  status: z.enum(["ACTIVE", "ARCHIVED", "PENDING", "CLOSED"]).default("ACTIVE"),
  targetImage: z.string().nullable().optional(),
  fullName: z.string().max(160).optional().nullable(),
  alias: z.string().max(160).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().max(160).optional().nullable(),
  country: z.string().max(80).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  address: z.string().max(400).optional().nullable(),
  socialMedia: z.array(z.string()).default([]),
  knownAccounts: z.array(z.string()).default([]),
  notes: z.string().max(8000).optional().nullable(),
  investigationSummary: z.string().max(8000).optional().nullable(),
  activityTimeline: z
    .array(z.object({ date: z.string(), event: z.string() }))
    .default([]),
  connections: z
    .array(z.object({ name: z.string(), relation: z.string() }))
    .default([]),
  additionalEvidence: z.string().max(8000).optional().nullable(),
  evidenceImages: z
    .array(z.string().max(7_000_000)) // ~5 MB base64 (4 MB raw)
    .max(10)
    .default([]),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("LOW"),
  tags: z.array(z.string().max(40)).max(40).default([]),
});

export type DossierInput = z.infer<typeof dossierSchema>;
