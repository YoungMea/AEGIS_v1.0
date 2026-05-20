import { en } from "./en";
import { ru } from "./ru";
import { uz } from "./uz";
import type { Locale, Translation } from "./types";

export const dictionaries: Record<Locale, Translation> = { en, ru, uz };

export const LOCALES: Locale[] = ["uz", "ru", "en"];
export const DEFAULT_LOCALE: Locale = "uz";

export type { Locale, Translation } from "./types";
