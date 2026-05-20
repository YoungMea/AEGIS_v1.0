/**
 * Centralized environment configuration.
 * Reads once, exposes typed constants throughout the app.
 */

const required = (name: string, fallback?: string): string => {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing required env: ${name}`);
    }
    return fallback ?? "";
  }
  return v;
};

export type OtpChannel = "simulate" | "telegram" | "sms";

function resolveChannel(): OtpChannel {
  // New key
  const ch = process.env.OTP_CHANNEL;
  if (ch === "simulate" || ch === "telegram" || ch === "sms") return ch;
  // Back-compat with the older OTP_MODE
  const mode = process.env.OTP_MODE;
  if (mode === "real") return "sms";
  if (mode === "simulate") return "simulate";
  return "simulate";
}

export const env = {
  JWT_SECRET: required(
    "JWT_SECRET",
    "dev-only-insecure-secret-please-change-in-production-32+chars",
  ),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
  DATABASE_URL: process.env.DATABASE_URL ?? "./data/aegis.db",

  OTP_CHANNEL: resolveChannel(),
  OTP_LENGTH: parseInt(process.env.OTP_LENGTH ?? "6", 10),
  OTP_TTL_SECONDS: parseInt(process.env.OTP_TTL_SECONDS ?? "300", 10),

  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? "",
  TELEGRAM_BOT_USERNAME:
    process.env.TELEGRAM_BOT_USERNAME ??
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ??
    "",

  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS ?? "12", 10),

  TWILIO: {
    SID: process.env.TWILIO_ACCOUNT_SID ?? "",
    TOKEN: process.env.TWILIO_AUTH_TOKEN ?? "",
    FROM: process.env.TWILIO_FROM_NUMBER ?? "",
  },

  AGENCY_NAME: process.env.NEXT_PUBLIC_AGENCY_NAME ?? "AEGIS",
  AGENCY_FULL:
    process.env.NEXT_PUBLIC_AGENCY_FULL ??
    "Advanced Electronic General Intelligence Service",
};
