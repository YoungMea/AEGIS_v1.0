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

type ItemKey = "aegisDemo" | "hawkeye" | "noLook" | "antChat" | "owlSight" | "hardening";

/**
 * Visual cover for each story. Cards have an oversized rounded-rectangle
 * cover that uses inline SVG so we don't need any image assets.
 */
function CoverArt({ kind }: { kind: ItemKey }) {
  if (kind === "owlSight") return <OwlSightCover />;
  if (kind === "hardening") return <HardeningCover />;
  if (kind === "noLook") return <NoLookCover />;
  if (kind === "antChat") return <AntChatCover />;
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
    { key: "owlSight", data: t.news.items.owlSight },
    { key: "hardening", data: t.news.items.hardening },
    { key: "antChat", data: t.news.items.antChat },
    { key: "noLook", data: t.news.items.noLook },
    { key: "hawkeye", data: t.news.items.hawkeye },
    { key: "aegisDemo", data: t.news.items.aegisDemo },
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


function NoLookCover() {
  return (
    <svg
      viewBox="0 0 800 320"
      className="block h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="nl-bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#06141B" />
          <stop offset="100%" stopColor="#020608" />
        </linearGradient>
        <linearGradient id="nl-shield" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#10F5A8" />
          <stop offset="100%" stopColor="#0AC97F" />
        </linearGradient>
      </defs>
      <rect width="800" height="320" fill="url(#nl-bg)" />

      {/* matrix-style streaming columns */}
      {Array.from({ length: 36 }).map((_, i) => (
        <g key={i} transform={`translate(${i * 22 + 14} 0)`} opacity="0.45">
          <rect
            y="0"
            width="2"
            height={40 + ((i * 13) % 80)}
            fill="rgba(16,245,168,0.18)"
          />
          <text
            x="-3"
            y={120 + ((i * 17) % 130)}
            fill="rgba(16,245,168,0.45)"
            fontFamily="ui-monospace, SFMono-Regular"
            fontSize="9"
          >
            {((i * 73) & 1).toString(16)}
            {((i * 91) & 1).toString(16)}
          </text>
          <text
            x="-3"
            y={210 + ((i * 23) % 60)}
            fill="rgba(16,245,168,0.25)"
            fontFamily="ui-monospace, SFMono-Regular"
            fontSize="9"
          >
            {(i * 17 + 3).toString(16).padStart(2, "0")}
          </text>
        </g>
      ))}

      {/* shield on the right */}
      <g transform="translate(580 160)">
        <path
          d="M0 -90 L70 -54 V14 C70 60 36 90 0 100 C-36 90 -70 60 -70 14 V-54 Z"
          fill="rgba(16,245,168,0.08)"
          stroke="url(#nl-shield)"
          strokeWidth="2"
        />
        <path
          d="M-26 6 L-6 28 L30 -22"
          fill="none"
          stroke="#10F5A8"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* lock body */}
        <g transform="translate(-26 32)">
          <rect
            x="0"
            y="14"
            width="52"
            height="36"
            rx="6"
            fill="rgba(16,245,168,0.12)"
            stroke="rgba(16,245,168,0.6)"
            strokeWidth="1.5"
          />
          <path
            d="M10 14 V4 a16 16 0 0 1 32 0 V14"
            fill="none"
            stroke="rgba(16,245,168,0.6)"
            strokeWidth="1.5"
          />
        </g>
      </g>

      {/* title */}
      <text
        x="48"
        y="84"
        fill="#10F5A8"
        fontFamily="ui-monospace, SFMono-Regular"
        fontSize="11"
        letterSpacing="6"
        fontWeight="600"
      >
        SECURITY · LIVE
      </text>
      <text
        x="48"
        y="146"
        fill="#FFFFFF"
        fontFamily="Orbitron, sans-serif"
        fontSize="46"
        letterSpacing="6"
        fontWeight="700"
      >
        NoLook
      </text>
      <text
        x="48"
        y="186"
        fill="rgba(255,255,255,0.55)"
        fontFamily="Orbitron, sans-serif"
        fontSize="14"
        letterSpacing="4"
      >
        AES-256-GCM AT-REST ENCRYPTION
      </text>
      <text
        x="48"
        y="270"
        fill="rgba(255,255,255,0.35)"
        fontFamily="ui-monospace, SFMono-Regular"
        fontSize="11"
        letterSpacing="4"
      >
        seal ▸ store ▸ unseal ▸ verify
      </text>
    </svg>
  );
}

function AntChatCover() {
  return (
    <svg
      viewBox="0 0 800 320"
      className="block h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <radialGradient id="ac-bg" cx="20%" cy="100%" r="100%">
          <stop offset="0%" stopColor="#0E2030" />
          <stop offset="60%" stopColor="#060B14" />
          <stop offset="100%" stopColor="#02050A" />
        </radialGradient>
      </defs>
      <rect width="800" height="320" fill="url(#ac-bg)" />

      {/* speech bubbles on the right */}
      <g transform="translate(440 70)" fontFamily="ui-monospace, SFMono-Regular" fontSize="11">
        {/* incoming */}
        <g>
          <rect x="0" y="0" width="160" height="36" rx="14" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)" />
          <text x="14" y="22" fill="rgba(255,255,255,0.7)">target spotted ▸ EU-N3</text>
        </g>
        {/* outgoing emerald */}
        <g transform="translate(60 60)">
          <rect x="0" y="0" width="220" height="36" rx="14" fill="rgba(16,245,168,0.12)" stroke="rgba(16,245,168,0.4)" />
          <text x="14" y="22" fill="#10F5A8">received · uploading evidence…</text>
        </g>
        {/* file chip */}
        <g transform="translate(40 120)">
          <rect x="0" y="0" width="200" height="58" rx="10" fill="rgba(255,255,255,0.04)" stroke="rgba(16,245,168,0.35)" />
          <rect x="14" y="14" width="30" height="30" rx="4" fill="rgba(16,245,168,0.18)" stroke="rgba(16,245,168,0.5)" />
          <text x="22" y="33" fill="#10F5A8" fontWeight="700">.pdf</text>
          <text x="56" y="22" fill="rgba(255,255,255,0.85)">evidence_03.pdf</text>
          <text x="56" y="38" fill="rgba(255,255,255,0.45)">1.3 MB · ENCRYPTED</text>
        </g>
        {/* dossier chip */}
        <g transform="translate(120 188)">
          <rect x="0" y="0" width="200" height="42" rx="10" fill="rgba(255,77,77,0.06)" stroke="rgba(255,77,77,0.4)" />
          <text x="14" y="18" fill="#FF8C8C" fontSize="9" letterSpacing="3">DOSSIER · CLASSIFIED</text>
          <text x="14" y="33" fill="rgba(255,255,255,0.85)">AGS-7F2A0E81</text>
        </g>
      </g>

      {/* title */}
      <text
        x="48"
        y="84"
        fill="#10F5A8"
        fontFamily="ui-monospace, SFMono-Regular"
        fontSize="11"
        letterSpacing="6"
        fontWeight="600"
      >
        MODULE · LIVE
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
        AntChat
      </text>
      <text
        x="48"
        y="186"
        fill="rgba(255,255,255,0.55)"
        fontFamily="Orbitron, sans-serif"
        fontSize="14"
        letterSpacing="4"
      >
        ENCRYPTED OPERATIVE COMMS
      </text>
      <text
        x="48"
        y="270"
        fill="rgba(255,255,255,0.35)"
        fontFamily="ui-monospace, SFMono-Regular"
        fontSize="11"
        letterSpacing="4"
      >
        text ▸ files ▸ dossier shares
      </text>
    </svg>
  );
}


function OwlSightCover() {
  return (
    <svg
      viewBox="0 0 800 320"
      className="block h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <radialGradient id="ow-bg" cx="80%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#0F1A24" />
          <stop offset="60%" stopColor="#060B14" />
          <stop offset="100%" stopColor="#02050A" />
        </radialGradient>
        <radialGradient id="ow-iris" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFB020" />
          <stop offset="55%" stopColor="#A86A00" />
          <stop offset="100%" stopColor="#1A0E00" />
        </radialGradient>
      </defs>
      <rect width="800" height="320" fill="url(#ow-bg)" />

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

      {/* Owl head — abstract: two big round eyes + beak */}
      <g transform="translate(560 165)">
        {/* head outline */}
        <path
          d="M-150 0 C-150 -110 -90 -150 0 -150 C90 -150 150 -110 150 0 C150 90 90 130 0 130 C-90 130 -150 90 -150 0 Z"
          fill="rgba(16,245,168,0.05)"
          stroke="rgba(16,245,168,0.4)"
          strokeWidth="2"
        />
        {/* feather tufts */}
        <path d="M-110 -110 L-90 -150 L-60 -120 Z" fill="rgba(16,245,168,0.18)" />
        <path d="M110 -110 L90 -150 L60 -120 Z" fill="rgba(16,245,168,0.18)" />

        {/* left eye */}
        <g transform="translate(-58 -10)">
          <circle r="48" fill="rgba(16,245,168,0.08)" stroke="rgba(16,245,168,0.45)" strokeWidth="2" />
          <circle r="34" fill="url(#ow-iris)" />
          <circle r="14" fill="#02050A" />
          <circle cx="-5" cy="-5" r="4" fill="rgba(255,255,255,0.85)" />
        </g>

        {/* right eye */}
        <g transform="translate(58 -10)">
          <circle r="48" fill="rgba(16,245,168,0.08)" stroke="rgba(16,245,168,0.45)" strokeWidth="2" />
          <circle r="34" fill="url(#ow-iris)" />
          <circle r="14" fill="#02050A" />
          <circle cx="-5" cy="-5" r="4" fill="rgba(255,255,255,0.85)" />
        </g>

        {/* beak */}
        <path
          d="M-10 30 L0 60 L10 30 Z"
          fill="rgba(16,245,168,0.7)"
          stroke="rgba(16,245,168,0.9)"
          strokeWidth="1.5"
        />

        {/* targeting reticle around the right eye */}
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const r1 = 60;
          const r2 = i % 3 === 0 ? 80 : 70;
          return (
            <line
              key={i}
              x1={58 + Math.cos(a) * r1}
              y1={-10 + Math.sin(a) * r1}
              x2={58 + Math.cos(a) * r2}
              y2={-10 + Math.sin(a) * r2}
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
        MODULE · LIVE
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
        OwlSight
      </text>
      <text
        x="48"
        y="186"
        fill="rgba(255,255,255,0.55)"
        fontFamily="Orbitron, sans-serif"
        fontSize="14"
        letterSpacing="4"
      >
        IMAGE OSINT · POWERED BY GEMINI
      </text>
      <text
        x="48"
        y="270"
        fill="rgba(255,255,255,0.35)"
        fontFamily="ui-monospace, SFMono-Regular"
        fontSize="11"
        letterSpacing="4"
      >
        EXIF ▸ OCR ▸ AI ▸ GEO-GUESS
      </text>
    </svg>
  );
}

function HardeningCover() {
  return (
    <svg
      viewBox="0 0 800 320"
      className="block h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="hd-bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#0A0F18" />
          <stop offset="100%" stopColor="#02060A" />
        </linearGradient>
      </defs>
      <rect width="800" height="320" fill="url(#hd-bg)" />

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

      {/* three icons in a row on the right: bell, speaker, archive */}
      <g transform="translate(440 90)" stroke="rgba(16,245,168,0.55)" strokeWidth="2" fill="none">
        {/* Bell */}
        <g transform="translate(0 0)">
          <rect x="-50" y="-40" width="100" height="100" rx="12" fill="rgba(16,245,168,0.06)" />
          <path d="M-22 14 a22 22 0 0 1 44 0 v6 l8 8 h-60 l8 -8 z" />
          <path d="M-6 36 a6 6 0 0 0 12 0" />
          <circle cx="22" cy="-22" r="6" fill="#10F5A8" stroke="none" />
        </g>
        {/* Speaker */}
        <g transform="translate(110 0)">
          <rect x="-50" y="-40" width="100" height="100" rx="12" fill="rgba(16,245,168,0.06)" />
          <path d="M-20 6 H-8 L8 -10 v40 L-8 14 H-20 z" fill="rgba(16,245,168,0.18)" />
          <path d="M16 -2 a12 12 0 0 1 0 24" />
          <path d="M22 -10 a22 22 0 0 1 0 40" />
        </g>
        {/* Cloud + arrow (backup) */}
        <g transform="translate(220 0)">
          <rect x="-50" y="-40" width="100" height="100" rx="12" fill="rgba(16,245,168,0.06)" />
          <path d="M-20 8 a18 18 0 0 1 36 -2 a14 14 0 0 1 4 26 H-18 a14 14 0 0 1 -2 -24 z" />
          <path d="M0 22 v18 m-10 -10 l10 10 l10 -10" strokeLinecap="round" strokeLinejoin="round" />
        </g>
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
        RELEASE · LIVE
      </text>
      <text
        x="48"
        y="146"
        fill="#FFFFFF"
        fontFamily="Orbitron, sans-serif"
        fontSize="44"
        letterSpacing="6"
        fontWeight="700"
      >
        HARDENING
      </text>
      <text
        x="48"
        y="186"
        fill="rgba(255,255,255,0.55)"
        fontFamily="Orbitron, sans-serif"
        fontSize="14"
        letterSpacing="4"
      >
        NOTIFY · SOUND · BACKUPS
      </text>
      <text
        x="48"
        y="270"
        fill="rgba(255,255,255,0.35)"
        fontFamily="ui-monospace, SFMono-Regular"
        fontSize="11"
        letterSpacing="4"
      >
        push ▸ blip ▸ aes-256-gcm ▸ telegram
      </text>
    </svg>
  );
}
