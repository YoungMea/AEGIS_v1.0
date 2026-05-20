"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Calendar,
  X,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { NewsItem } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";

type ItemKey = "aegisDemo" | "hawkeye";

/**
 * Visual cover for each story. Cards have an oversized rounded-rectangle
 * cover that uses inline SVG so we don't need any image assets.
 */
function CoverArt({ kind }: { kind: ItemKey }) {
  if (kind === "aegisDemo") {
    return (
      <svg
        viewBox="0 0 800 320"
        className="block h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <radialGradient id="aeg-bg" cx="50%" cy="20%" r="80%">
            <stop offset="0%" stopColor="#0F2A20" />
            <stop offset="60%" stopColor="#060B12" />
            <stop offset="100%" stopColor="#02050A" />
          </radialGradient>
          <linearGradient id="aeg-line" x1="0" x2="1">
            <stop offset="0%" stopColor="rgba(16,245,168,0)" />
            <stop offset="50%" stopColor="rgba(16,245,168,0.6)" />
            <stop offset="100%" stopColor="rgba(16,245,168,0)" />
          </linearGradient>
        </defs>
        <rect width="800" height="320" fill="url(#aeg-bg)" />
        {/* grid */}
        {Array.from({ length: 25 }).map((_, i) => (
          <line
            key={`v${i}`}
            x1={i * 32}
            y1="0"
            x2={i * 32}
            y2="320"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <line
            key={`h${i}`}
            x1="0"
            y1={i * 28}
            x2="800"
            y2={i * 28}
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="1"
          />
        ))}
        {/* concentric rings */}
        <g transform="translate(400 170)" opacity="0.55">
          <circle r="120" stroke="rgba(16,245,168,0.25)" fill="none" strokeWidth="1" />
          <circle
            r="90"
            stroke="rgba(16,245,168,0.4)"
            fill="none"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <circle r="55" stroke="rgba(16,245,168,0.7)" fill="none" strokeWidth="1.5" />
          <circle r="6" fill="#10F5A8" />
        </g>
        {/* scan line */}
        <rect x="0" y="120" width="800" height="2" fill="url(#aeg-line)" opacity="0.7" />
        {/* big title */}
        <text
          x="48"
          y="84"
          fill="#10F5A8"
          fontFamily="ui-monospace, SFMono-Regular"
          fontSize="11"
          letterSpacing="6"
          fontWeight="600"
        >
          AEGIS · DEMO
        </text>
        <text
          x="48"
          y="146"
          fill="#FFFFFF"
          fontFamily="Orbitron, sans-serif"
          fontSize="42"
          letterSpacing="6"
          fontWeight="700"
        >
          INTELLIGENCE
        </text>
        <text
          x="48"
          y="190"
          fill="#10F5A8"
          fontFamily="Orbitron, sans-serif"
          fontSize="42"
          letterSpacing="6"
          fontWeight="700"
        >
          PLATFORM
        </text>
        <text
          x="48"
          y="270"
          fill="rgba(255,255,255,0.4)"
          fontFamily="ui-monospace, SFMono-Regular"
          fontSize="11"
          letterSpacing="4"
        >
          v1.0 · CLASSIFIED · OP/AEGIS
        </text>
      </svg>
    );
  }

  // HawkEye cover
  return (
    <svg
      viewBox="0 0 800 320"
      className="block h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <radialGradient id="hawk-bg" cx="80%" cy="50%" r="80%">
          <stop offset="0%" stopColor="#1B0F22" />
          <stop offset="60%" stopColor="#080610" />
          <stop offset="100%" stopColor="#02030A" />
        </radialGradient>
        <radialGradient id="iris" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#10F5A8" />
          <stop offset="50%" stopColor="#0AC97F" />
          <stop offset="100%" stopColor="#02160E" />
        </radialGradient>
      </defs>
      <rect width="800" height="320" fill="url(#hawk-bg)" />
      {/* faint grid */}
      {Array.from({ length: 25 }).map((_, i) => (
        <line
          key={`v${i}`}
          x1={i * 32}
          y1="0"
          x2={i * 32}
          y2="320"
          stroke="rgba(255,255,255,0.03)"
          strokeWidth="1"
        />
      ))}
      {/* eye on the right */}
      <g transform="translate(580 160)">
        <ellipse cx="0" cy="0" rx="180" ry="80" fill="rgba(16,245,168,0.06)" stroke="rgba(16,245,168,0.4)" strokeWidth="2" />
        <ellipse cx="0" cy="0" rx="120" ry="56" fill="none" stroke="rgba(16,245,168,0.25)" strokeWidth="1" strokeDasharray="3 6" />
        <circle cx="0" cy="0" r="46" fill="url(#iris)" />
        <circle cx="0" cy="0" r="20" fill="#02050A" />
        <circle cx="-8" cy="-8" r="6" fill="rgba(255,255,255,0.85)" />
        {/* radiating ticks */}
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * Math.PI * 2;
          const r1 = 70;
          const r2 = i % 3 === 0 ? 92 : 80;
          return (
            <line
              key={i}
              x1={Math.cos(a) * r1}
              y1={Math.sin(a) * r1 * 0.45}
              x2={Math.cos(a) * r2}
              y2={Math.sin(a) * r2 * 0.45}
              stroke="rgba(16,245,168,0.5)"
              strokeWidth="1"
            />
          );
        })}
      </g>
      {/* title */}
      <text
        x="48"
        y="80"
        fill="#10F5A8"
        fontFamily="ui-monospace, SFMono-Regular"
        fontSize="11"
        letterSpacing="6"
        fontWeight="600"
      >
        MODULE · COMING SOON
      </text>
      <text
        x="48"
        y="146"
        fill="#FFFFFF"
        fontFamily="Orbitron, sans-serif"
        fontSize="48"
        letterSpacing="6"
        fontWeight="700"
      >
        HAWKEYE
      </text>
      <text
        x="48"
        y="186"
        fill="rgba(255,255,255,0.55)"
        fontFamily="Orbitron, sans-serif"
        fontSize="14"
        letterSpacing="4"
      >
        USERNAME OSINT · POWERED BY SHERLOCK
      </text>
      <text
        x="48"
        y="270"
        fill="rgba(255,255,255,0.35)"
        fontFamily="ui-monospace, SFMono-Regular"
        fontSize="11"
        letterSpacing="4"
      >
        scan ▸ probe ▸ correlate ▸ file
      </text>
    </svg>
  );
}

export function NewsSection() {
  const { t } = useI18n();
  const [active, setActive] = useState<ItemKey | null>(null);

  const items: { key: ItemKey; data: NewsItem }[] = [
    { key: "aegisDemo", data: t.news.items.aegisDemo },
    { key: "hawkeye", data: t.news.items.hawkeye },
  ];

  return (
    <div className="pt-6">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="badge inline-flex mb-3">
          <Sparkles size={11} /> {t.news.badge}
        </div>
        <h1 className="font-display tracking-[0.16em] uppercase text-2xl sm:text-3xl text-white">
          {t.news.titlePart1}{" "}
          <span className="text-emerald-glow text-glow">
            {t.news.titlePart2}
          </span>
        </h1>
        <p className="text-white/45 text-xs mt-2 leading-relaxed">
          {t.news.subtitle}
        </p>
      </div>

      {/* Stack */}
      <div className="mt-8 max-w-3xl mx-auto space-y-6">
        {items.map(({ key, data }, i) => (
          <NewsCard
            key={key}
            kind={key}
            item={data}
            index={i}
            onOpen={() => setActive(key)}
            readMoreLabel={t.news.readMore}
          />
        ))}
      </div>

      <AnimatePresence>
        {active && (
          <NewsModal
            kind={active}
            item={t.news.items[active]}
            onClose={() => setActive(null)}
            backLabel={t.news.backToList}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function NewsCard({
  kind,
  item,
  index,
  onOpen,
  readMoreLabel,
}: {
  kind: ItemKey;
  item: NewsItem;
  index: number;
  onOpen: () => void;
  readMoreLabel: string;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="surface-strong overflow-hidden rounded-2xl group"
    >
      {/* Cover */}
      <button
        type="button"
        onClick={onOpen}
        className="block relative w-full aspect-[16/7] sm:aspect-[16/6] overflow-hidden"
      >
        <CoverArt kind={kind} />
        {/* corner brackets */}
        <CornerBrackets />
        {/* hover scan beam */}
        <div className="pointer-events-none absolute inset-x-0 -top-1/2 h-32 bg-gradient-to-b from-transparent via-emerald-glow/20 to-transparent blur-2xl opacity-0 group-hover:opacity-100 group-hover:translate-y-[120%] transition-all duration-1000" />
        {/* category badge */}
        <div className="absolute top-3 left-3">
          <span className="badge bg-black/60">{item.category}</span>
        </div>
        <div className="absolute top-3 right-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/65 bg-black/60 px-2 py-1 rounded-md flex items-center gap-1.5">
            <Calendar size={10} />
            {item.date}
          </span>
        </div>
      </button>

      <div className="p-5 sm:p-6">
        <h2 className="font-display tracking-[0.08em] uppercase text-lg sm:text-xl text-white leading-snug">
          {item.title}
        </h2>
        <p className="mt-2 text-white/65 text-[13px] leading-relaxed">
          {item.blurb}
        </p>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onOpen}
            className="btn-primary h-9 px-4"
          >
            {readMoreLabel} <ArrowRight size={14} />
          </button>
          {item.cta && (
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-glow/70">
              · {item.cta}
            </span>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function CornerBrackets() {
  const corners = [
    "top-2 left-2",
    "top-2 right-2 rotate-90",
    "bottom-2 left-2 -rotate-90",
    "bottom-2 right-2 rotate-180",
  ];
  return (
    <>
      {corners.map((c, i) => (
        <svg
          key={i}
          width="22"
          height="22"
          viewBox="0 0 22 22"
          className={cn(
            "pointer-events-none absolute text-emerald-glow/55",
            c,
          )}
          style={{ transformOrigin: "center" }}
        >
          <path
            d="M2 2H10M2 2V10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="square"
            fill="none"
          />
        </svg>
      ))}
    </>
  );
}

function NewsModal({
  kind,
  item,
  onClose,
  backLabel,
}: {
  kind: ItemKey;
  item: NewsItem;
  onClose: () => void;
  backLabel: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-start sm:place-items-center bg-black/75 backdrop-blur-md p-3 sm:p-6 overflow-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 24, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="surface-strong w-full max-w-3xl my-4 rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-ink-100/85 backdrop-blur-md border-b border-white/[0.06] px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={onClose}
            className="btn-ghost h-9 text-xs uppercase tracking-[0.18em] font-mono"
          >
            <ArrowLeft size={14} /> {backLabel}
          </button>
          <span className="ml-auto badge">{item.category}</span>
          <button
            onClick={onClose}
            aria-label="close"
            className="h-9 w-9 grid place-items-center rounded-md border border-white/10 text-white/70 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative aspect-[16/7] sm:aspect-[16/6] overflow-hidden">
          <CoverArt kind={kind} />
          <CornerBrackets />
        </div>

        <div className="p-5 sm:p-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40 flex items-center gap-2">
            <Calendar size={11} /> {item.date}
          </div>
          <h2 className="mt-2 font-display tracking-[0.08em] uppercase text-2xl sm:text-3xl text-white leading-tight">
            {item.title}
          </h2>

          <div className="mt-5 space-y-3 text-white/75 text-[13.5px] leading-relaxed">
            {item.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {item.highlights && item.highlights.length > 0 && (
            <div className="mt-7">
              <div className="dotted-divider h-px w-full mb-5" />
              <div className="grid sm:grid-cols-2 gap-3">
                {item.highlights.map((h, i) => (
                  <div
                    key={i}
                    className="surface p-4 hover:border-emerald-glow/30 transition"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] tracking-[0.22em] text-emerald-glow">
                        §{(i + 1).toString().padStart(2, "0")}
                      </span>
                      <h3 className="text-sm font-medium text-white">
                        {h.title}
                      </h3>
                    </div>
                    <p className="mt-1.5 text-[12.5px] text-white/55 leading-relaxed">
                      {h.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {item.cta && (
            <div className="mt-7 flex items-center gap-3">
              <span className="badge-ok">
                <Sparkles size={10} /> {item.cta}
              </span>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
