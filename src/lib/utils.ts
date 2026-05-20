import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(ts: number, withTime = false): string {
  const d = new Date(ts);
  const date = d.toISOString().slice(0, 10);
  if (!withTime) return date;
  const time = d.toISOString().slice(11, 19) + "Z";
  return `${date} ${time}`;
}

export function maskUid(uid: string): string {
  if (uid.length <= 4) return uid;
  return uid.slice(0, 2) + "•".repeat(uid.length - 4) + uid.slice(-2);
}
