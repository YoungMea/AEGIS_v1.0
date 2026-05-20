"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Loader2,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  ExternalLink,
  Headphones,
} from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

/**
 * Public env hook — Next.js inlines NEXT_PUBLIC_* at build time, so this
 * is the recommended way to read it from a client component.
 */
const SUPPORT_BOT_USERNAME = (
  process.env.NEXT_PUBLIC_TELEGRAM_SUPPORT_BOT_USERNAME ?? ""
).trim();

function buildSupportLink(name: string, message: string) {
  if (!SUPPORT_BOT_USERNAME) return "";
  // Telegram doesn't support arbitrary preset text via t.me links to bots
  // (only via deep links of the form ?start=token), so we just open the bot
  // and let the user paste the prepared text. We pass a short, safe slug
  // through the start parameter for analytics if you want it later.
  const slug = "support";
  return `https://t.me/${SUPPORT_BOT_USERNAME}?start=${encodeURIComponent(slug)}`;
}

export function SupportSection() {
  const { t } = useI18n();
  const toast = useToast();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const botConfigured = SUPPORT_BOT_USERNAME.length > 0;

  async function openTelegram() {
    if (!botConfigured) return;
    setBusy(true);
    try {
      const composed =
        (name.trim() ? `${name.trim()}: ` : "") +
        message.trim();
      if (composed) {
        try {
          await navigator.clipboard.writeText(composed);
          toast.push({
            type: "success",
            title: t.support.copiedTitle,
            message: t.support.copiedDesc,
          });
        } catch {
          /* clipboard might be unavailable on insecure origins */
        }
      }
      // Allow the toast to render briefly before navigating away.
      setTimeout(() => {
        window.open(buildSupportLink(name, message), "_blank", "noopener");
      }, 250);
    } finally {
      setTimeout(() => setBusy(false), 600);
    }
  }

  return (
    <div className="pt-6 max-w-3xl mx-auto">
      <div className="text-center">
        <div className="badge inline-flex mb-3">
          <Headphones size={11} /> {t.support.badge}
        </div>
        <h1 className="font-display tracking-[0.16em] uppercase text-2xl sm:text-3xl text-white">
          {t.support.titlePart1}{" "}
          <span className="text-emerald-glow text-glow">
            {t.support.titlePart2}
          </span>
        </h1>
        <p className="text-white/45 text-xs mt-2 leading-relaxed max-w-xl mx-auto">
          {t.support.subtitle}
        </p>
      </div>

      {/* Contact card */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-7 relative"
      >
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-[#37BBFE]/30 via-transparent to-emerald-glow/20 blur-xl opacity-50" />
        <div className="relative surface-strong rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="h-14 w-14 shrink-0 rounded-xl bg-[#0E1A26] border border-[#37BBFE]/40 grid place-items-center">
            <TelegramLogo size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display tracking-[0.1em] uppercase text-lg text-white">
                {t.support.contactCardTitle}
              </h2>
              <span className="badge-ok">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-glow animate-pulseDot" />
                {t.support.onlineNow}
              </span>
            </div>
            <p className="mt-1.5 text-white/55 text-[13px] leading-relaxed">
              {t.support.contactCardDesc}
            </p>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
              {t.support.avgResponse}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Form */}
      <div className="mt-6 surface-strong rounded-2xl p-5 sm:p-6">
        <h3 className="font-display tracking-[0.1em] uppercase text-base text-white">
          {t.support.formTitle}
        </h3>
        <p className="mt-1 text-white/50 text-xs">{t.support.formDesc}</p>

        {!botConfigured && (
          <div className="mt-4 surface border-amber-glow/40 bg-amber-glow/[0.06] p-3 font-mono text-[11px] uppercase tracking-[0.18em] text-amber-glow">
            {t.support.botUnavailable}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (botConfigured && message.trim()) openTelegram();
          }}
          className="mt-4 space-y-3"
        >
          <Field label={t.support.nameLabel}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.support.namePlaceholder}
              maxLength={80}
              className="field"
            />
          </Field>

          <Field
            label={t.support.messageLabel}
            hint={`${message.length}/2000 · ${t.support.messageHint}`}
          >
            <textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
              placeholder={t.support.messagePlaceholder}
              className="field resize-none"
            />
          </Field>

          <div className="flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={!botConfigured || !message.trim() || busy}
              className="btn-primary h-10 px-4"
            >
              {busy ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {t.support.sending}
                </>
              ) : (
                <>
                  {t.support.sendButton}
                  <Send size={14} />
                </>
              )}
            </button>
          </div>
        </form>

        {botConfigured && (
          <div className="mt-4 dotted-divider h-px w-full" />
        )}

        {botConfigured && (
          <a
            href={buildSupportLink("", "")}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 relative block group"
          >
            <div className="absolute -inset-px rounded-lg bg-gradient-to-r from-[#37BBFE]/40 via-[#1E96D9]/30 to-[#37BBFE]/40 blur-md opacity-50 group-hover:opacity-100 transition" />
            <div className="relative flex items-center gap-3 rounded-lg border border-[#37BBFE]/40 bg-[#0E1A26]/80 px-4 py-3 hover:bg-[#0E2435]/80 transition">
              <TelegramLogo size={20} />
              <div className="min-w-0 flex-1 text-left">
                <div className="text-sm text-white">
                  {t.support.openTelegram}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40 truncate">
                  t.me/{SUPPORT_BOT_USERNAME}
                </div>
              </div>
              <ExternalLink size={15} className="text-white/60" />
            </div>
          </a>
        )}
      </div>

      {/* FAQ */}
      <div className="mt-7">
        <h3 className="font-display tracking-[0.1em] uppercase text-sm text-white flex items-center gap-2">
          <HelpCircle size={14} className="text-emerald-glow" />
          {t.support.faqTitle}
        </h3>
        <div className="mt-3 space-y-2">
          {t.support.faq.map((item, i) => (
            <FaqRow key={i} q={item.q} a={item.a} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="label-mono">{label}</span>
        {hint && (
          <span className="font-mono text-[10px] text-white/30 truncate ml-2">
            {hint}
          </span>
        )}
      </div>
      {children}
    </label>
  );
}

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-[13px] text-white/85 flex-1">{q}</span>
        <ChevronDown
          size={14}
          className={cn(
            "shrink-0 text-white/45 transition-transform",
            open && "rotate-180 text-emerald-glow",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-0 text-[12.5px] text-white/60 leading-relaxed">
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TelegramLogo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="tg-grad-sup" x1="120" y1="0" x2="120" y2="240">
          <stop offset="0%" stopColor="#37BBFE" />
          <stop offset="100%" stopColor="#007DBB" />
        </linearGradient>
      </defs>
      <circle cx="120" cy="120" r="120" fill="url(#tg-grad-sup)" />
      <path
        d="M51 117l130-50c6-2 11 1 9 9l-22 105c-1 6-5 8-11 5l-31-23-15 14c-2 2-3 3-7 3l3-32 88-79c4-3-1-5-6-2l-108 68-31-10c-7-2-7-7 1-10z"
        fill="white"
      />
    </svg>
  );
}
