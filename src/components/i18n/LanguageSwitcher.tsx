"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Languages, Check, ChevronDown } from "lucide-react";
import { useI18n } from "./I18nProvider";
import { LOCALES, dictionaries, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  /** Compact = code-only on mobile (UZ, RU, EN). */
  variant?: "compact" | "full";
}

/**
 * Pill-shaped language picker. Works as a segmented control on desktop and
 * collapses to a dropdown on small screens.
 */
export function LanguageSwitcher({ className, variant = "compact" }: Props) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* Desktop / tablet: segmented pill */}
      <div className="hidden sm:flex items-center gap-0.5 surface px-1 h-9">
        <span className="px-1.5 text-emerald-glow/70">
          <Languages size={13} />
        </span>
        {LOCALES.map((l) => (
          <button
            key={l}
            onClick={() => setLocale(l)}
            aria-pressed={locale === l}
            aria-label={dictionaries[l].meta.nativeName}
            className={cn(
              "h-7 px-2.5 rounded-md font-mono text-[11px] tracking-[0.18em] uppercase transition",
              locale === l
                ? "bg-emerald-glow/15 text-emerald-glow border border-emerald-glow/40 shadow-glow-emerald"
                : "text-white/55 hover:text-white",
            )}
          >
            {dictionaries[l].meta.code}
          </button>
        ))}
      </div>

      {/* Mobile: dropdown */}
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.language.select}
        className="sm:hidden flex items-center gap-1.5 h-9 px-2.5 rounded-md border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
      >
        <Languages size={14} className="text-emerald-glow/80" />
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-white/85">
          {dictionaries[locale].meta.code}
        </span>
        <ChevronDown size={12} className="text-white/50" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            role="listbox"
            className="sm:hidden absolute right-0 mt-2 w-44 surface-strong p-1 z-50"
          >
            {LOCALES.map((l) => (
              <li key={l}>
                <button
                  type="button"
                  role="option"
                  aria-selected={locale === l}
                  onClick={() => {
                    setLocale(l);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-2 rounded text-[13px] transition",
                    locale === l
                      ? "bg-emerald-glow/10 text-emerald-glow"
                      : "text-white/85 hover:bg-white/[0.05]",
                  )}
                >
                  <span className="font-mono text-[10px] tracking-[0.2em] text-white/45 w-6">
                    {dictionaries[l].meta.code}
                  </span>
                  <span className="flex-1 text-left">
                    {dictionaries[l].meta.nativeName}
                  </span>
                  {locale === l && (
                    <Check size={14} className="text-emerald-glow" />
                  )}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {/* Suppress unused-variable warning when variant is provided but unused. */}
      <span className="hidden">{variant}</span>
    </div>
  );
}
