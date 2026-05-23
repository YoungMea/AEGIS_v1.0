"use client";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n/I18nProvider";

interface Props {
  active: boolean; // is the chat tab currently open?
  unread: number;
  onClick: () => void;
}

/**
 * Floating quick-action button anchored to the bottom-right corner.
 * Hidden when the chat section is already open so it never overlaps the
 * thread composer.
 */
export function ChatFab({ active, unread, onClick }: Props) {
  const { t } = useI18n();

  return (
    <AnimatePresence>
      {!active && (
        <motion.button
          type="button"
          onClick={onClick}
          aria-label={t.nav.chat}
          initial={{ opacity: 0, scale: 0.6, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 24 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
          className={cn(
            "no-print fixed z-40 right-4 bottom-16 sm:right-6 sm:bottom-20",
            "h-14 w-14 rounded-full",
            "bg-emerald-glow/15 border border-emerald-glow/50",
            "shadow-[0_0_30px_rgba(16,245,168,0.45),inset_0_0_0_1px_rgba(255,255,255,0.04)]",
            "backdrop-blur-md",
            "grid place-items-center",
            "text-emerald-glow",
            "hover:bg-emerald-glow/25 hover:shadow-[0_0_45px_rgba(16,245,168,0.65)]",
            "transition",
          )}
        >
          {/* Pulsing ring when there are unread messages */}
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute inset-0 rounded-full border border-emerald-glow/60 animate-ping"
            />
          )}
          <MessageSquare size={22} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-emerald-glow text-ink-50 font-mono text-[10px] font-bold leading-none border-2 border-ink-50">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
          {/* Tooltip */}
          <span className="pointer-events-none absolute right-full mr-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-ink-100 border border-white/10 font-mono text-[10px] uppercase tracking-[0.18em] text-white/85 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
            {t.nav.chat}
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
