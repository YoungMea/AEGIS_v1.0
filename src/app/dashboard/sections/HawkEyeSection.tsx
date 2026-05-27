"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  Search,
  Loader2,
  CheckCircle2,
  AtSign,
  Mail,
  Phone,
  History,
  Sparkles,
  ExternalLink,
  Link2,
  ImageIcon,
  Save,
  ShieldCheck,
  AlertTriangle,
  Instagram,
  Lock,
  BadgeCheck,
} from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import type { Dossier } from "@/lib/dossier";

type Mode = "username" | "email" | "phone";

interface ProbeResult {
  platform: string;
  status: "found" | "not-found" | "unclear" | "error" | "pending" | "idle";
  url: string | null;
  display: string | null;
  detail: string | null;
  durationMs: number;
}

interface ArchiveSnapshot {
  url: string;
  timestamp: string;
  source: string;
  date: string;
}

interface InstagramMetadata {
  handle: string;
  url: string;
  fullName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  followers: number | null;
  following: number | null;
  posts: number | null;
  isPrivate: boolean | null;
  isVerified: boolean | null;
}

interface AiSummary {
  narrative: string;
  confidence: number;
  highlights: string[];
  riskHints: string[];
  provider: "gemini" | "openrouter" | "none";
}

interface EagleEyeReport {
  query: string;
  mode: Mode;
  startedAt: number;
  finishedAt: number;
  hawk: ProbeResult[];
  archive: ArchiveSnapshot[];
  instagram: InstagramMetadata | null;
  ai: AiSummary | null;
  links: string[];
  imageUrls: string[];
}

export function HawkEyeSection() {
  const { t } = useI18n();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>("username");
  const [query, setQuery] = useState("");
  const [report, setReport] = useState<EagleEyeReport | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dossier-pick state
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [appending, setAppending] = useState(false);

  useEffect(() => {
    // Lazy fetch the dossier list — only needed for the "Save to dossier" picker.
    fetch("/api/dossiers")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.dossiers && setDossiers(d.dossiers))
      .catch(() => {});
  }, []);

  const startScan = useCallback(async () => {
    const trimmed = query.trim().replace(/^@+/, "");
    if (!trimmed) return;
    setError(null);
    setReport(null);
    setScanning(true);
    try {
      const res = await fetch("/api/hawkeye/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, q: trimmed }),
      });
      if (!res.ok) {
        const txt = await res.text();
        setError(txt || "Scan failed");
        return;
      }
      const data = (await res.json()) as { report: EagleEyeReport };
      setReport(data.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setScanning(false);
    }
  }, [query, mode]);

  const stats = useMemo(() => {
    if (!report) return { found: 0, archive: 0, links: 0 };
    return {
      found: report.hawk.filter((h) => h.status === "found").length,
      archive: report.archive.length,
      links: report.links.length,
    };
  }, [report]);

  const elapsed =
    report && !scanning
      ? ((report.finishedAt - report.startedAt) / 1000).toFixed(1)
      : null;

  /* ----- Dossier append */

  async function appendToDossier(dossierId: string) {
    if (!report) return;
    setAppending(true);
    try {
      const res = await fetch("/api/dossiers/append", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dossierId,
          links: report.links,
          imageUrls: report.imageUrls,
          summary: buildSummaryBlock(report),
          tags: ["hawkeye", report.mode, report.query.slice(0, 32)],
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        toast.push({
          type: "error",
          title: t.hawkEye?.appendError ?? "Could not append",
          message: txt.slice(0, 120),
        });
        return;
      }
      const data = (await res.json()) as {
        appended: { links: number; images: number };
      };
      toast.push({
        type: "success",
        title: t.hawkEye?.appendOk ?? "Filed to dossier",
        message:
          (t.hawkEye?.appendSummary ?? "Added") +
          ` · ${data.appended.links} links · ${data.appended.images} images`,
      });
      setPickerOpen(false);
    } finally {
      setAppending(false);
    }
  }

  /* ----- Render */

  return (
    <div className="pt-6 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <div className="badge inline-flex mb-2">
            <Eye size={11} /> {t.hawkEye?.badge ?? "HAWKEYE · DEEP RECON"}
          </div>
          <h1 className="font-display tracking-[0.16em] uppercase text-2xl sm:text-3xl text-white">
            {t.hawkEye?.titlePart1 ?? "Hawk"}
            <span className="text-amber-glow text-glow">
              {t.hawkEye?.titlePart2 ?? "Eye"}
            </span>
          </h1>
          <p className="text-white/45 text-xs mt-1.5 max-w-md">
            {t.hawkEye?.subtitle ??
              "Cross-platform OSINT with archived snapshots, public Instagram metadata and an AI-driven identity narrative."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Stat label={t.hawkEye?.statMatches ?? "MATCHES"} value={stats.found} />
          <Stat
            label={t.hawkEye?.statArchive ?? "ARCHIVED"}
            value={stats.archive}
            accent
          />
          <Stat label={t.hawkEye?.statLinks ?? "LINKS"} value={stats.links} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="surface-strong rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="flex items-center surface px-1 h-10 shrink-0">
          <ModeBtn
            active={mode === "username"}
            onClick={() => setMode("username")}
            icon={<AtSign size={12} />}
            label={t.hawkEye?.modeUsername ?? "Username"}
          />
          <ModeBtn
            active={mode === "email"}
            onClick={() => setMode("email")}
            icon={<Mail size={12} />}
            label={t.hawkEye?.modeEmail ?? "Email"}
          />
          <ModeBtn
            active={mode === "phone"}
            onClick={() => setMode("phone")}
            icon={<Phone size={12} />}
            label={t.hawkEye?.modePhone ?? "Phone"}
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
                ? t.hawkEye?.placeholderUsername ?? "agent_codename"
                : mode === "phone"
                  ? t.hawkEye?.placeholderPhone ?? "998901234567"
                  : t.hawkEye?.placeholderEmail ?? "target@domain.com"
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
          className="h-10 px-5 rounded-md font-mono text-[11px] uppercase tracking-[0.22em] bg-amber-glow/20 text-amber-glow border border-amber-glow/40 hover:bg-amber-glow/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {scanning ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Search size={12} />
          )}
          {scanning
            ? t.hawkEye?.scanning ?? "Scanning"
            : t.hawkEye?.runScan ?? "Run scan"}
        </button>

        {report && (
          <button
            onClick={() => setPickerOpen(true)}
            disabled={appending || (report.links.length === 0 && report.imageUrls.length === 0)}
            className="h-10 px-5 rounded-md font-mono text-[11px] uppercase tracking-[0.22em] bg-emerald-glow/20 text-emerald-glow border border-emerald-glow/40 hover:bg-emerald-glow/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {appending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Save size={12} />
            )}
            {t.hawkEye?.saveToDossier ?? "Save to dossier"}
          </button>
        )}
      </div>

      {/* Status line */}
      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
        {scanning ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-glow animate-pulse" />
            {t.hawkEye?.statusLive ??
              "DEEP RECON RUNNING · WAYBACK + AI NARRATIVE"}
          </>
        ) : elapsed ? (
          <>
            <CheckCircle2 size={11} className="text-emerald-glow" />
            {t.hawkEye?.statusComplete ?? "RECON COMPLETE · "}
            {elapsed}s
          </>
        ) : (
          <>
            <Eye size={11} className="text-amber-glow" />
            {t.hawkEye?.statusReady ?? "STAND BY · TARGET ANY IDENTIFIER"}
          </>
        )}
        {error && (
          <span className="text-warning normal-case tracking-normal ml-2">
            {error}
          </span>
        )}
      </div>

      {/* Body */}
      {report && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* AI summary */}
          <div className="lg:col-span-2 space-y-4">
            {report.ai && report.ai.narrative ? (
              <AiNarrativeCard ai={report.ai} t={t} />
            ) : (
              <div className="surface-strong rounded-xl p-4 text-[12px] text-white/45 flex items-center gap-2">
                <Sparkles size={12} className="text-amber-glow/60" />
                {t.hawkEye?.aiUnavailable ??
                  "AI summary unavailable — set GEMINI_API_KEY or OPENROUTER_API_KEY."}
              </div>
            )}

            {report.instagram && (
              <InstagramCard ig={report.instagram} t={t} />
            )}

            <ProbeGrid hawk={report.hawk} t={t} />
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <ArchiveTimeline archive={report.archive} t={t} />
            <LinkBundle report={report} t={t} />
          </div>
        </div>
      )}

      {/* Dossier picker */}
      <AnimatePresence>
        {pickerOpen && report && (
          <DossierPicker
            dossiers={dossiers}
            onClose={() => setPickerOpen(false)}
            onPick={appendToDossier}
            appending={appending}
            t={t}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* --------------------------------------------------------- helpers */

function buildSummaryBlock(r: EagleEyeReport): string {
  const lines: string[] = [];
  lines.push(`Target: ${r.query} (${r.mode})`);
  if (r.ai?.narrative) {
    lines.push("");
    lines.push(r.ai.narrative);
    if (r.ai.confidence)
      lines.push(`Confidence: ${r.ai.confidence}/100`);
  }
  const found = r.hawk.filter((h) => h.status === "found");
  if (found.length) {
    lines.push("");
    lines.push("Confirmed accounts:");
    for (const f of found) {
      lines.push(`  - ${f.platform}${f.display ? ` (${f.display})` : ""}: ${f.url ?? ""}`);
    }
  }
  if (r.archive.length) {
    lines.push("");
    lines.push(`Archive snapshots: ${r.archive.length}`);
  }
  return lines.join("\n");
}

/* --------------------------------------------------------- components */

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
  value: number;
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
        {value.toString().padStart(2, "0")}
      </div>
    </div>
  );
}

function AiNarrativeCard({
  ai,
  t,
}: {
  ai: AiSummary;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const conf = ai.confidence ?? 0;
  const tone =
    conf >= 75
      ? "border-emerald-glow/40 bg-emerald-glow/[0.04]"
      : conf >= 40
        ? "border-amber-glow/40 bg-amber-glow/[0.04]"
        : "border-white/[0.08]";
  return (
    <div className={cn("rounded-xl border p-5", tone)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-amber-glow" />
          <span className="font-display tracking-[0.18em] uppercase text-[13px] text-white">
            {t.hawkEye?.aiTitle ?? "AI Identity Narrative"}
          </span>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
          {t.hawkEye?.confidence ?? "CONFIDENCE"} · {conf}/100
        </div>
      </div>
      <p className="text-[13px] text-white/85 leading-relaxed">
        {ai.narrative}
      </p>
      {ai.highlights.length > 0 && (
        <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {ai.highlights.map((h, i) => (
            <li
              key={i}
              className="text-[11px] text-white/70 flex items-start gap-1.5"
            >
              <span className="mt-1 inline-block h-1 w-1 rounded-full bg-amber-glow/70 shrink-0" />
              {h}
            </li>
          ))}
        </ul>
      )}
      {ai.riskHints.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ai.riskHints.map((r, i) => (
            <span
              key={i}
              className="font-mono text-[9px] uppercase tracking-[0.2em] px-2 py-1 rounded bg-warning/10 text-warning border border-warning/30 inline-flex items-center gap-1"
            >
              <AlertTriangle size={9} />
              {r}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 font-mono text-[9px] uppercase tracking-[0.22em] text-white/30">
        {t.hawkEye?.via ?? "VIA"} · {ai.provider.toUpperCase()}
      </div>
    </div>
  );
}

function InstagramCard({
  ig,
  t,
}: {
  ig: InstagramMetadata;
  t: ReturnType<typeof useI18n>["t"];
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-fuchsia-500/10 to-amber-500/[0.03] p-4">
      <div className="flex items-start gap-3">
        {ig.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ig.avatarUrl}
            alt={ig.handle}
            referrerPolicy="no-referrer"
            className="h-14 w-14 rounded-md object-cover border border-white/10 shrink-0"
          />
        ) : (
          <div className="h-14 w-14 rounded-md grid place-items-center bg-fuchsia-500/15 border border-fuchsia-400/30 shrink-0">
            <Instagram size={18} className="text-fuchsia-300" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display tracking-[0.12em] uppercase text-[15px] text-white truncate">
              {ig.fullName ?? `@${ig.handle}`}
            </span>
            {ig.isVerified && (
              <BadgeCheck size={13} className="text-sky-300" />
            )}
            {ig.isPrivate && (
              <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/55 inline-flex items-center gap-1">
                <Lock size={9} /> {t.hawkEye?.private ?? "PRIVATE"}
              </span>
            )}
          </div>
          <div className="font-mono text-[10px] text-white/40 mt-0.5">
            instagram.com/{ig.handle}
          </div>
          {ig.bio && (
            <p className="mt-2 text-[12px] text-white/75 whitespace-pre-line line-clamp-3">
              {ig.bio}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-mono text-white/55">
            {typeof ig.posts === "number" && (
              <span>
                <span className="text-white">{formatCount(ig.posts)}</span>{" "}
                {t.hawkEye?.posts ?? "POSTS"}
              </span>
            )}
            {typeof ig.followers === "number" && (
              <span>
                <span className="text-white">{formatCount(ig.followers)}</span>{" "}
                {t.hawkEye?.followers ?? "FOLLOWERS"}
              </span>
            )}
            {typeof ig.following === "number" && (
              <span>
                <span className="text-white">{formatCount(ig.following)}</span>{" "}
                {t.hawkEye?.following ?? "FOLLOWING"}
              </span>
            )}
          </div>
          <a
            href={ig.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-amber-glow hover:text-white"
          >
            <ExternalLink size={10} /> {t.hawkEye?.openProfile ?? "Open profile"}
          </a>
        </div>
      </div>
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function ProbeGrid({
  hawk,
  t,
}: {
  hawk: ProbeResult[];
  t: ReturnType<typeof useI18n>["t"];
}) {
  return (
    <div className="surface-strong rounded-xl p-4">
      <div className="font-display tracking-[0.18em] uppercase text-[13px] text-white mb-3 flex items-center gap-2">
        <ShieldCheck size={13} className="text-emerald-glow" />
        {t.hawkEye?.probeTitle ?? "Cross-platform probe"}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {hawk.map((h) => (
          <ProbePill key={h.platform} probe={h} />
        ))}
      </div>
    </div>
  );
}

function ProbePill({ probe }: { probe: ProbeResult }) {
  const tone =
    probe.status === "found"
      ? "border-emerald-glow/40 bg-emerald-glow/[0.06] text-emerald-glow"
      : probe.status === "not-found"
        ? "border-white/[0.06] bg-ink-300/30 text-white/40"
        : probe.status === "unclear"
          ? "border-amber-glow/30 bg-amber-glow/[0.04] text-amber-glow"
          : "border-warning/30 bg-warning/[0.04] text-warning";
  const inner = (
    <div className={cn("rounded-md border px-2.5 py-2", tone)}>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] truncate">
        {probe.platform}
      </div>
      <div className="text-[11px] text-white/85 mt-0.5 truncate">
        {probe.display ?? probe.detail ?? "—"}
      </div>
    </div>
  );
  return probe.url && probe.status === "found" ? (
    <a href={probe.url} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  ) : (
    inner
  );
}

function ArchiveTimeline({
  archive,
  t,
}: {
  archive: ArchiveSnapshot[];
  t: ReturnType<typeof useI18n>["t"];
}) {
  return (
    <div className="surface-strong rounded-xl p-4">
      <div className="font-display tracking-[0.18em] uppercase text-[13px] text-white mb-3 flex items-center gap-2">
        <History size={13} className="text-amber-glow" />
        {t.hawkEye?.archiveTitle ?? "Wayback timeline"}
      </div>
      {archive.length === 0 ? (
        <div className="text-[11px] text-white/40">
          {t.hawkEye?.archiveEmpty ??
            "No archived snapshots — try the username mode."}
        </div>
      ) : (
        <ul className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {archive.map((a, i) => (
            <li
              key={`${a.timestamp}-${i}`}
              className="border-l-2 border-amber-glow/40 pl-3"
            >
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
                    {a.source}
                  </span>
                  <span className="font-mono text-[9px] text-white/40">
                    {a.date.slice(0, 10)}
                  </span>
                </div>
                <div className="text-[11px] text-amber-glow group-hover:text-white truncate">
                  {a.url.replace(/^https?:\/\//, "")}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LinkBundle({
  report,
  t,
}: {
  report: EagleEyeReport;
  t: ReturnType<typeof useI18n>["t"];
}) {
  return (
    <div className="surface-strong rounded-xl p-4">
      <div className="font-display tracking-[0.18em] uppercase text-[13px] text-white mb-3 flex items-center gap-2">
        <Link2 size={13} className="text-emerald-glow" />
        {t.hawkEye?.bundleTitle ?? "Collected links"}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="surface px-3 py-2">
          <div className="label-mono flex items-center gap-1">
            <Link2 size={9} /> {t.hawkEye?.linkCount ?? "LINKS"}
          </div>
          <div className="font-display text-[15px] text-white">
            {report.links.length}
          </div>
        </div>
        <div className="surface px-3 py-2">
          <div className="label-mono flex items-center gap-1">
            <ImageIcon size={9} /> {t.hawkEye?.imageCount ?? "IMAGES"}
          </div>
          <div className="font-display text-[15px] text-white">
            {report.imageUrls.length}
          </div>
        </div>
      </div>
      {report.links.length === 0 && (
        <div className="text-[11px] text-white/40">
          {t.hawkEye?.bundleEmpty ?? "Run a scan to collect links."}
        </div>
      )}
      {report.links.length > 0 && (
        <ul className="space-y-1 max-h-[180px] overflow-y-auto pr-1">
          {report.links.slice(0, 50).map((l, i) => (
            <li key={i}>
              <a
                href={l}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-emerald-glow/85 hover:text-white truncate block font-mono"
              >
                {l.replace(/^https?:\/\//, "")}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DossierPicker({
  dossiers,
  onClose,
  onPick,
  appending,
  t,
}: {
  dossiers: Dossier[];
  onClose: () => void;
  onPick: (id: string) => void;
  appending: boolean;
  t: ReturnType<typeof useI18n>["t"];
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-ink-50/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 8 }}
        onClick={(e) => e.stopPropagation()}
        className="surface-strong rounded-xl p-5 max-w-md w-full"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="font-display tracking-[0.18em] uppercase text-[14px] text-white">
            {t.hawkEye?.pickDossier ?? "Pick a dossier"}
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45 hover:text-white"
          >
            {t.common.close}
          </button>
        </div>
        {dossiers.length === 0 ? (
          <div className="text-[12px] text-white/45">
            {t.hawkEye?.noDossiers ??
              "No dossiers yet — create one in My Database first."}
          </div>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto space-y-1.5 pr-1">
            {dossiers.map((d) => (
              <li key={d.id}>
                <button
                  disabled={appending}
                  onClick={() => onPick(d.id)}
                  className="w-full text-left surface px-3 py-2.5 hover:border-emerald-glow/30 transition disabled:opacity-50"
                >
                  <div className="text-[13px] text-white truncate">
                    {d.fullName ?? d.alias ?? "—"}
                  </div>
                  <div className="font-mono text-[10px] text-white/45 mt-0.5">
                    {d.classification} · {d.riskLevel} · AGS-
                    {d.id.slice(-8).toUpperCase()}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </motion.div>
  );
}
