"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Folder,
  Plus,
  Search as SearchIcon,
  Trash2,
  Eye,
  Pencil,
  Filter,
  ShieldAlert,
} from "lucide-react";
import type { Dossier } from "@/lib/dossier";
import { cn, formatDate } from "@/lib/utils";
import { useI18n } from "@/components/i18n/I18nProvider";

interface Props {
  dossiers: Dossier[];
  onOpen: (d: Dossier) => void;
  onEdit: (d: Dossier) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}

export function DatabaseSection({
  dossiers,
  onOpen,
  onEdit,
  onDelete,
  onCreate,
}: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState<string>("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dossiers.filter((d) => {
      const matchQ =
        !q ||
        [d.fullName, d.alias, d.email, d.phone, d.city, d.country, ...d.tags]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      const matchR = risk === "ALL" || d.riskLevel === risk;
      return matchQ && matchR;
    });
  }, [dossiers, query, risk]);

  const stats = useMemo(() => {
    const total = dossiers.length;
    const active = dossiers.filter((d) => d.status === "ACTIVE").length;
    const high = dossiers.filter(
      (d) => d.riskLevel === "HIGH" || d.riskLevel === "CRITICAL",
    ).length;
    return { total, active, high };
  }, [dossiers]);

  const riskLabels: Record<string, string> = {
    ALL: "ALL",
    LOW: t.database.riskLow,
    MEDIUM: t.database.riskMedium,
    HIGH: t.database.riskHigh,
    CRITICAL: t.database.riskCritical,
  };

  return (
    <div className="pt-6">
      {/* Heading */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="badge mb-2">{t.database.badge}</div>
          <h1 className="font-display tracking-[0.16em] uppercase text-2xl sm:text-3xl text-white">
            {t.database.titlePart1}{" "}
            <span className="text-emerald-glow text-glow">
              {t.database.titlePart2}
            </span>
          </h1>
          <p className="text-white/45 text-xs mt-1">{t.database.subtitle}</p>
        </div>

        <div className="flex flex-wrap gap-3 items-stretch">
          <Stat label={t.database.statDossiers} value={stats.total.toString().padStart(4, "0")} />
          <Stat label={t.database.statActive} value={stats.active.toString().padStart(4, "0")} accent />
          <Stat label={t.database.statHighRisk} value={stats.high.toString().padStart(4, "0")} warn={stats.high > 0} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <SearchIcon
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.database.searchPlaceholder}
            className="field pl-9"
          />
        </div>
        <div className="flex items-center gap-1 surface px-1 h-11 overflow-x-auto">
          <Filter size={14} className="text-white/40 ml-2 shrink-0" />
          {["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"].map((r) => (
            <button
              key={r}
              onClick={() => setRisk(r)}
              className={cn(
                "px-2.5 h-8 rounded-md font-mono text-[10px] uppercase tracking-[0.18em] shrink-0",
                risk === r
                  ? "bg-emerald-glow/15 text-emerald-glow border border-emerald-glow/40"
                  : "text-white/45 hover:text-white",
              )}
            >
              {riskLabels[r]}
            </button>
          ))}
        </div>
        <button onClick={onCreate} className="btn-primary h-11">
          <Plus size={16} />
          {t.database.newDossier}
        </button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState onCreate={onCreate} hasAny={dossiers.length > 0} />
      ) : (
        <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((d, i) => (
            <FolderCard
              key={d.id}
              dossier={d}
              index={i}
              onOpen={() => onOpen(d)}
              onEdit={() => onEdit(d)}
              onDelete={() => onDelete(d.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "surface px-4 py-2.5 min-w-[110px]",
        warn && "border-warning/30",
        accent && "border-emerald-glow/30",
      )}
    >
      <div className="label-mono">{label}</div>
      <div
        className={cn(
          "font-display tracking-widest text-lg",
          accent ? "text-emerald-glow text-glow" : warn ? "text-warning" : "text-white",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState({
  onCreate,
  hasAny,
}: {
  onCreate: () => void;
  hasAny: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="mt-12 surface-strong p-10 text-center relative overflow-hidden">
      <div className="absolute inset-0 grid-overlay opacity-30" />
      <div className="relative">
        <div className="mx-auto h-16 w-16 rounded-full grid place-items-center bg-emerald-glow/10 border border-emerald-glow/30">
          <Folder size={28} className="text-emerald-glow" />
        </div>
        <h3 className="mt-4 heading-display text-lg text-white">
          {hasAny ? t.database.emptyTitleNoMatch : t.database.emptyTitle}
        </h3>
        <p className="mt-2 text-white/50 text-xs max-w-sm mx-auto">
          {hasAny ? t.database.emptyDescNoMatch : t.database.emptyDesc}
        </p>
        {!hasAny && (
          <button onClick={onCreate} className="btn-primary mt-5">
            <Plus size={16} /> {t.database.openInvestigation}
          </button>
        )}
      </div>
    </div>
  );
}

function FolderCard({
  dossier,
  index,
  onOpen,
  onEdit,
  onDelete,
}: {
  dossier: Dossier;
  index: number;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const ref = `AGS-${dossier.id.slice(-8).toUpperCase()}`;
  const riskColor =
    dossier.riskLevel === "CRITICAL"
      ? "text-warning border-warning/40"
      : dossier.riskLevel === "HIGH"
        ? "text-warning border-warning/30"
        : dossier.riskLevel === "MEDIUM"
          ? "text-amber-glow border-amber-glow/30"
          : "text-emerald-glow border-emerald-glow/30";

  const riskLabel = (() => {
    switch (dossier.riskLevel) {
      case "LOW": return t.database.riskLow;
      case "MEDIUM": return t.database.riskMedium;
      case "HIGH": return t.database.riskHigh;
      case "CRITICAL": return t.database.riskCritical;
      default: return dossier.riskLevel;
    }
  })();

  const statusLabel = (() => {
    switch (dossier.status) {
      case "ACTIVE": return t.database.statusActive;
      case "ARCHIVED": return t.database.statusArchived;
      case "PENDING": return t.database.statusPending;
      case "CLOSED": return t.database.statusClosed;
      default: return dossier.status;
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: Math.min(index, 8) * 0.04 }}
      whileHover={{ y: -3 }}
      className="folder p-5 group cursor-pointer relative overflow-hidden"
      onClick={onOpen}
    >
      <div className="absolute inset-0 bg-grid-noise opacity-30 pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-glow/40 to-transparent opacity-0 group-hover:opacity-100 transition" />

      <div className="flex items-start gap-4 relative">
        <Thumb src={dossier.targetImage} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("badge", riskColor)}>
              <ShieldAlert size={10} /> {riskLabel}
            </span>
            <span className="badge">{dossier.classification}</span>
          </div>
          <h3 className="mt-2 font-semibold text-white truncate">
            {dossier.fullName ?? t.database.untitledSubject}
          </h3>
          {dossier.alias && (
            <p className="font-mono text-[11px] text-white/50 truncate">
              {t.database.aliasLabel} · {dossier.alias}
            </p>
          )}
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-3 text-[11px]">
        <Field label="REF" value={ref} mono />
        <Field
          label={t.add.statusLabel}
          value={statusLabel}
          mono
          accent={dossier.status === "ACTIVE"}
        />
        <Field
          label="LOCATION"
          value={
            [dossier.city, dossier.country].filter(Boolean).join(", ") || "—"
          }
        />
        <Field label={t.add.updated} value={formatDate(dossier.updatedAt)} mono />
      </div>

      {dossier.tags.length > 0 && (
        <div className="relative mt-3 flex flex-wrap gap-1.5">
          {dossier.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded font-mono text-[10px] uppercase bg-white/[0.04] border border-white/10 text-white/60"
            >
              {tag}
            </span>
          ))}
          {dossier.tags.length > 5 && (
            <span className="font-mono text-[10px] text-white/40">
              +{dossier.tags.length - 5}
            </span>
          )}
        </div>
      )}

      <div className="relative mt-4 pt-3 border-t border-white/[0.06] flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="btn-ghost h-8 text-[10px] uppercase tracking-[0.18em] font-mono px-2.5"
        >
          <Eye size={12} /> {t.common.open}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="btn-ghost h-8 text-[10px] uppercase tracking-[0.18em] font-mono px-2.5"
        >
          <Pencil size={12} /> {t.common.edit}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(t.database.confirmDelete)) onDelete();
          }}
          className="btn-ghost h-8 text-[10px] uppercase tracking-[0.18em] font-mono px-2.5 ml-auto hover:text-warning"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </motion.div>
  );
}

function Field({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="label-mono">{label}</div>
      <div
        className={cn(
          "truncate",
          mono ? "font-mono" : "",
          accent ? "text-emerald-glow" : "text-white/80",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Thumb({ src }: { src: string | null }) {
  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-white/10 bg-ink-200">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover saturate-[0.85] contrast-110"
        />
      ) : (
        <div className="h-full w-full grid place-items-center font-mono text-[10px] text-white/30">
          NO IMG
        </div>
      )}
      <div className="absolute inset-0 ring-1 ring-emerald-glow/0 group-hover:ring-emerald-glow/40 transition" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-emerald-glow/0 to-emerald-glow/0 group-hover:via-emerald-glow/10 group-hover:to-transparent" />
    </div>
  );
}
