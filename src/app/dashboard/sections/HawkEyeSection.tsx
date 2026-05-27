"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crosshair,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Mail,
  AtSign,
  Phone,
  ShieldOff,
} from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/lib/utils";

type Mode = "username" | "email" | "phone";
type ProbeStatus = "idle" | "pending" | "found" | "not-found" | "unclear" | "error";

interface PlatformResult {
  platform: string;
  status: ProbeStatus;
  url: string | null;
  display: string | null;
  detail: string | null;
  durationMs: number;
}

const PLATFORM_META: Record<
  string,
  { label: string; tone: string; icon: string; subtitle: string }
> = {
  telegram: {
    label: "Telegram",
    tone: "from-sky-500/30 to-sky-500/5 border-sky-400/30",
    icon: "✈",
    subtitle: "t.me/<handle>",
  },
  tiktok: {
    label: "TikTok",
    tone: "from-pink-500/30 to-pink-500/5 border-pink-400/30",
    icon: "♪",
    subtitle: "tiktok.com/@<handle>",
  },
  instagram: {
    label: "Instagram",
    tone: "from-amber-500/30 to-fuchsia-500/5 border-amber-400/30",
    icon: "◎",
    subtitle: "instagram.com/<handle>",
  },
  snapchat: {
    label: "Snapchat",
    tone: "from-yellow-400/40 to-yellow-400/5 border-yellow-300/40",
    icon: "👻",
    subtitle: "snapchat.com/add/<handle>",
  },
  blink: {
    label: "Blink",
    tone: "from-fuchsia-500/30 to-violet-500/5 border-fuchsia-400/30",
    icon: "★",
    subtitle: "blinkmap.com/u/<handle>",
  },
  gravatar: {
    label: "Gravatar",
    tone: "from-emerald-500/30 to-emerald-500/5 border-emerald-400/30",
    icon: "✉",
    subtitle: "gravatar.com/<md5>",
  },
  whatsapp: {
    label: "WhatsApp",
    tone: "from-emerald-500/30 to-emerald-500/5 border-emerald-400/30",
    icon: "✆",
    subtitle: "wa.me/<phone>",
  },
  telegramPhone: {
    label: "Telegram",
    tone: "from-sky-500/30 to-sky-500/5 border-sky-400/30",
    icon: "✈",
    subtitle: "t.me/+<phone>",
  },
  blinkPhone: {
    label: "Blink",
    tone: "from-fuchsia-500/30 to-violet-500/5 border-fuchsia-400/30",
    icon: "★",
    subtitle: "blinkmap.com (in-app contacts)",
  },
  viber: {
    label: "Viber",
    tone: "from-violet-500/30 to-violet-500/5 border-violet-400/30",
    icon: "☏",
    subtitle: "viber://chat?number=<phone>",
  },
  signal: {
    label: "Signal",
    tone: "from-blue-500/30 to-blue-500/5 border-blue-400/30",
    icon: "▲",
    subtitle: "signal.me/#p/<phone>",
  },
  github: {
    label: "GitHub",
    tone: "from-zinc-500/30 to-zinc-500/5 border-zinc-400/30",
    icon: "⌥",
    subtitle: "github.com/<handle>",
  },
};

const USERNAME_LIST = [
  "telegram",
  "tiktok",
  "instagram",
  "snapchat",
  "blink",
  "github",
];
// Email mode hits Gravatar AND GitHub directly with the email; the rest
// of the social platforms get probed against the email's localpart.
const EMAIL_LIST = [
  "gravatar",
  "github",
  "telegram",
  "tiktok",
  "instagram",
  "snapchat",
  "blink",
];
const PHONE_LIST = [
  "whatsapp",
  "telegramPhone",
  "viber",
  "signal",
  "blinkPhone",
];

export function HawkEyeSection() {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("username");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Record<string, PlatformResult>>({});
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const evtRef = useRef<EventSource | null>(null);

  const platforms = useMemo(() => {
    if (mode === "email") return EMAIL_LIST;
    if (mode === "phone") return PHONE_LIST;
    return USERNAME_LIST;
  }, [mode]);

  const close = useCallback(() => {
    if (evtRef.current) {
      try {
        evtRef.current.close();
      } catch {
        /* ignore */
      }
      evtRef.current = null;
    }
  }, []);

  const startScan = useCallback(() => {
    setError(null);
    let trimmed = query.trim().replace(/^@+/, "");
    // Phone mode: keep digits and a leading +.
    if (mode === "phone") {
      trimmed = query.trim();
    }
    if (!trimmed) return;

    close();
    setResults(
      Object.fromEntries(
        platforms.map((p) => [
          p,
          {
            platform: p,
            status: "idle" as ProbeStatus,
            url: null,
            display: null,
            detail: null,
            durationMs: 0,
          },
        ]),
      ),
    );
    setScanning(true);
    setStartedAt(Date.now());

    const url = `/api/hawkeye/scan?mode=${mode}&q=${encodeURIComponent(trimmed)}`;
    const es = new EventSource(url);
    evtRef.current = es;

    es.addEventListener("pending", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as { platform: string };
      setResults((r) => ({
        ...r,
        [data.platform]: {
          ...(r[data.platform] ?? {
            platform: data.platform,
            url: null,
            display: null,
            detail: null,
            durationMs: 0,
          }),
          platform: data.platform,
          status: "pending",
          url: null,
          display: null,
          detail: null,
          durationMs: 0,
        },
      }));
    });

    es.addEventListener("result", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as PlatformResult;
      setResults((r) => ({
        ...r,
        [data.platform]: {
          ...data,
          status: data.status as ProbeStatus,
        },
      }));
    });

    es.addEventListener("done", () => {
      setScanning(false);
      close();
    });

    es.onerror = () => {
      setScanning(false);
      setError(t.hawkeye?.scanFailed ?? "Scan failed");
      close();
    };
  }, [query, mode, platforms, close, t.hawkeye]);

  const summary = useMemo(() => {
    const arr = Object.values(results);
    return {
      total: arr.length,
      found: arr.filter((r) => r.status === "found").length,
      notFound: arr.filter((r) => r.status === "not-found").length,
      pending: arr.filter((r) => r.status === "pending").length,
    };
  }, [results]);

  const elapsed =
    startedAt && !scanning
      ? ((Date.now() - startedAt) / 1000).toFixed(1)
      : null;

  return (
    <div className="pt-6 pb-12">
      {/* ----- Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <div className="badge inline-flex mb-2">
            <Crosshair size={11} /> {t.hawkeye?.badge ?? "HAWKEYE · OSINT"}
          </div>
          <h1 className="font-display tracking-[0.16em] uppercase text-2xl sm:text-3xl text-white">
            {t.hawkeye?.titlePart1 ?? "Hawk"}
            <span className="text-amber-glow text-glow">
              {t.hawkeye?.titlePart2 ?? "Eye"}
            </span>
          </h1>
          <p className="text-white/45 text-xs mt-1.5 max-w-md">
            {t.hawkeye?.subtitle ??
              "Hunt usernames and emails across Telegram, TikTok, Instagram and Snapchat. Live probes, no credentials required."}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Stat label={t.hawkeye?.statTargets ?? "TARGETS"} value={platforms.length.toString().padStart(2, "0")} />
          <Stat
            label={t.hawkeye?.statFound ?? "FOUND"}
            value={summary.found.toString().padStart(2, "0")}
            accent
          />
          <Stat
            label={t.hawkeye?.statMissing ?? "MISSING"}
            value={summary.notFound.toString().padStart(2, "0")}
          />
        </div>
      </div>

      {/* ----- Mode toggle + query */}
      <div className="surface-strong rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="flex items-center surface px-1 h-10 shrink-0">
          <ModeBtn
            active={mode === "username"}
            onClick={() => setMode("username")}
            icon={<AtSign size={12} />}
            label={t.hawkeye?.modeUsername ?? "Username"}
          />
          <ModeBtn
            active={mode === "email"}
            onClick={() => setMode("email")}
            icon={<Mail size={12} />}
            label={t.hawkeye?.modeEmail ?? "Email"}
          />
          <ModeBtn
            active={mode === "phone"}
            onClick={() => setMode("phone")}
            icon={<Phone size={12} />}
            label={t.hawkeye?.modePhone ?? "Phone"}
          />
        </div>
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 font-mono text-[12px]">
            {mode === "username" ? "@" : mode === "phone" ? "+" : ""}
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !scanning) startScan();
            }}
            placeholder={
              mode === "username"
                ? t.hawkeye?.placeholderUsername ?? "agent_codename"
                : mode === "phone"
                  ? t.hawkeye?.placeholderPhone ?? "998901234567"
                  : t.hawkeye?.placeholderEmail ?? "target@domain.com"
            }
            className={cn(
              "w-full h-10 bg-ink-300/60 border border-white/[0.06] rounded-md font-mono text-[13px] text-white placeholder-white/30 focus:outline-none focus:border-amber-glow/50",
              mode === "username" || mode === "phone" ? "pl-7 pr-3" : "px-3",
            )}
            spellCheck={false}
            autoComplete="off"
            inputMode={mode === "phone" ? "tel" : "text"}
          />
        </div>
        <button
          onClick={startScan}
          disabled={scanning || !query.trim()}
          className={cn(
            "h-10 px-5 rounded-md font-mono text-[11px] uppercase tracking-[0.22em] transition shrink-0",
            "bg-amber-glow/20 text-amber-glow border border-amber-glow/40 hover:bg-amber-glow/30",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "flex items-center gap-2",
          )}
        >
          {scanning ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Search size={12} />
          )}
          {scanning
            ? t.hawkeye?.scanning ?? "Scanning"
            : t.hawkeye?.runScan ?? "Run scan"}
        </button>
      </div>

      {/* ----- Status line */}
      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
        {scanning ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-glow animate-pulse" />
            {t.hawkeye?.statusLive ?? "LIVE PROBE · "}{summary.pending}/{platforms.length}
          </>
        ) : elapsed ? (
          <>
            <CheckCircle2 size={11} className="text-emerald-glow" />
            {t.hawkeye?.statusComplete ?? "SCAN COMPLETE · "}{elapsed}s
          </>
        ) : (
          <>
            <Crosshair size={11} className="text-amber-glow" />
            {t.hawkeye?.statusReady ?? "READY · STAND BY"}
          </>
        )}
        {error && (
          <span className="text-warning normal-case tracking-normal ml-2">
            {error}
          </span>
        )}
      </div>

      {/* ----- Platform cards */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {platforms.map((p) => {
          const meta = PLATFORM_META[p];
          const r = results[p];
          return (
            <PlatformCard
              key={p}
              platform={p}
              meta={meta}
              result={r}
              i18n={t.hawkeye}
            />
          );
        })}
      </div>

      {/* ----- Tips footer */}
      <div className="mt-6 text-[11px] text-white/35 font-mono leading-relaxed">
        {t.hawkeye?.tip ??
          "TIP · USERNAME mode probes 4 social platforms. EMAIL mode currently checks Gravatar — more sources arrive in the next release."}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- */

function ModeBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-8 px-3 rounded-md font-mono text-[10px] uppercase tracking-[0.22em] flex items-center gap-1.5 transition",
        active
          ? "bg-amber-glow/15 text-amber-glow border border-amber-glow/40"
          : "text-white/45 hover:text-white",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "surface px-4 py-2.5 min-w-[100px]",
        accent && "border-amber-glow/30",
      )}
    >
      <div className="label-mono">{label}</div>
      <div
        className={cn(
          "font-display tracking-widest text-lg",
          accent ? "text-amber-glow text-glow" : "text-white",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function PlatformCard({
  platform,
  meta,
  result,
  i18n,
}: {
  platform: string;
  meta: (typeof PLATFORM_META)[string] | undefined;
  result: PlatformResult | undefined;
  i18n: Record<string, string> | undefined;
}) {
  const status: ProbeStatus = (result?.status as ProbeStatus) ?? "idle";
  const tone =
    status === "found"
      ? "border-emerald-glow/40 bg-emerald-glow/[0.04]"
      : status === "not-found"
        ? "border-white/[0.06] bg-ink-300/40"
        : status === "unclear"
          ? "border-amber-glow/30 bg-amber-glow/[0.04]"
          : status === "error"
            ? "border-warning/40 bg-warning/[0.04]"
            : status === "pending"
              ? "border-amber-glow/30 bg-amber-glow/[0.06]"
              : "border-white/[0.06]";

  const StatusIcon =
    status === "found"
      ? CheckCircle2
      : status === "not-found"
        ? XCircle
        : status === "unclear"
          ? AlertCircle
          : status === "error"
            ? ShieldOff
            : status === "pending"
              ? Loader2
              : null;

  const statusColor =
    status === "found"
      ? "text-emerald-glow"
      : status === "not-found"
        ? "text-white/40"
        : status === "unclear"
          ? "text-amber-glow"
          : status === "error"
            ? "text-warning"
            : status === "pending"
              ? "text-amber-glow"
              : "text-white/30";

  const statusLabel =
    status === "found"
      ? i18n?.statusFound ?? "FOUND"
      : status === "not-found"
        ? i18n?.statusNotFound ?? "NOT FOUND"
        : status === "unclear"
          ? i18n?.statusUnclear ?? "UNCLEAR"
          : status === "error"
            ? i18n?.statusError ?? "ERROR"
            : status === "pending"
              ? i18n?.statusPending ?? "PROBING…"
              : i18n?.statusIdle ?? "STAND BY";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative rounded-xl border p-4 overflow-hidden bg-gradient-to-br",
        meta?.tone,
        tone,
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none">{meta?.icon}</span>
            <span className="font-display tracking-[0.18em] uppercase text-[15px] text-white">
              {meta?.label ?? platform}
            </span>
          </div>
          <div className="font-mono text-[10px] text-white/40 mt-1">
            {meta?.subtitle}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {StatusIcon && (
            <StatusIcon
              size={13}
              className={cn(
                statusColor,
                status === "pending" && "animate-spin",
              )}
            />
          )}
          <span
            className={cn(
              "font-mono text-[9px] uppercase tracking-[0.22em]",
              statusColor,
            )}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Detail */}
      <AnimatePresence mode="wait">
        {status === "found" && result && (
          <motion.div
            key="found"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            {result.display && (
              <div className="text-[12px] text-white/85 line-clamp-2 break-words">
                {result.display}
              </div>
            )}
            {result.url && (
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-glow hover:text-white"
              >
                <ExternalLink size={10} />
                {i18n?.openProfile ?? "Open profile"}
              </a>
            )}
          </motion.div>
        )}
        {status !== "found" && status !== "idle" && (result?.detail || result?.url) && (
          <motion.div
            key="meta"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-1.5"
          >
            {result?.detail && (
              <div className="text-[11px] text-white/55">{result.detail}</div>
            )}
            {result?.url && (
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[10px] text-white/40 hover:text-white/70 truncate"
              >
                <ExternalLink size={9} />
                <span className="truncate">{result.url.replace(/^https?:\/\//, "")}</span>
              </a>
            )}
          </motion.div>
        )}
        {status === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[11px] text-white/30 font-mono"
          >
            {i18n?.cardIdle ?? "Awaiting target…"}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Duration footer */}
      {result?.durationMs ? (
        <div className="mt-3 pt-2 border-t border-white/[0.04] font-mono text-[9px] uppercase tracking-[0.22em] text-white/30">
          {(result.durationMs / 1000).toFixed(2)}s
        </div>
      ) : null}
    </motion.div>
  );
}
