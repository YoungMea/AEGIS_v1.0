"use client";
import { motion } from "framer-motion";
import {
  X,
  Pencil,
  ShieldAlert,
  MapPin,
  Phone,
  Mail,
  Tag,
  Clock,
  Users,
  FileText,
  Printer,
} from "lucide-react";
import type { Dossier } from "@/lib/dossier";
import type { SessionUserDto } from "../types";
import { Barcode } from "@/components/ui/Barcode";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/components/i18n/I18nProvider";

interface Props {
  dossier: Dossier;
  user: SessionUserDto;
  onClose: () => void;
  onEdit: () => void;
}

export function DossierViewModal({ dossier, user, onClose, onEdit }: Props) {
  const { t } = useI18n();
  const ref = `AGS-${dossier.id.slice(-8).toUpperCase()}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/75 backdrop-blur-md p-3 sm:p-6 overflow-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="paper rounded-xl w-full max-w-4xl my-6 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="no-print sticky top-0 z-10 bg-ink-100/85 backdrop-blur-md border-b border-white/[0.06] px-4 sm:px-6 py-3 flex items-center gap-3">
          <span className="badge">REF · {ref}</span>
          <span className="badge bg-warning/[0.06] border-warning/30 text-warning">
            {dossier.classification}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="btn-ghost h-9 text-xs uppercase tracking-[0.18em] font-mono"
            >
              <Printer size={14} /> {t.common.print}
            </button>
            <button
              onClick={onEdit}
              className="btn-ghost h-9 text-xs uppercase tracking-[0.18em] font-mono"
            >
              <Pencil size={14} /> {t.common.edit}
            </button>
            <button
              onClick={onClose}
              className="h-9 w-9 grid place-items-center rounded-md border border-white/10 text-white/70 hover:text-white"
              aria-label={t.common.close}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="px-6 sm:px-10 pt-7 pb-4 border-b border-white/[0.06] relative">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
                AEGIS · Investigation Dossier
              </div>
              <h2 className="font-display tracking-[0.16em] uppercase text-2xl sm:text-3xl text-white mt-1">
                {dossier.fullName ?? t.database.untitledSubject}
              </h2>
              {dossier.alias && (
                <div className="font-mono text-xs text-white/50 mt-1">
                  {t.database.aliasLabel} · {dossier.alias}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <RiskBadge level={dossier.riskLevel} t={t} />
                <span className="badge">{dossier.status}</span>
                <span className="badge">{t.add.created} {formatDate(dossier.createdAt)}</span>
                <span className="badge">{t.add.updated} {formatDate(dossier.updatedAt)}</span>
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-3">
              <Barcode value={ref} />
              <div className="stamp">CLASSIFIED</div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 sm:px-10 py-7 grid lg:grid-cols-[220px_1fr] gap-7">
          <div className="space-y-4">
            <div className="aspect-[4/5] rounded-md overflow-hidden bg-ink-200 border border-white/10">
              {dossier.targetImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={dossier.targetImage}
                  alt=""
                  className="h-full w-full object-cover saturate-[0.85] contrast-110"
                />
              ) : (
                <div className="h-full w-full grid place-items-center font-mono text-[11px] text-white/30">
                  NO IMAGERY
                </div>
              )}
            </div>
            <div className="surface p-3 grid grid-cols-2 gap-y-2 font-mono text-[11px]">
              <span className="label-mono">FILED BY</span>
              <span className="text-right text-white/80 truncate">
                {user.displayName ?? "OPERATIVE"}
              </span>
              <span className="label-mono">UID</span>
              <span className="text-right text-white/80">{user.uid}</span>
              <span className="label-mono">REF</span>
              <span className="text-right text-white/80">{ref}</span>
            </div>
          </div>

          <div className="space-y-7">
            <ViewSection title={t.add.sections.subject} icon={<ShieldAlert size={14} />}>
              <Grid>
                <KV label={t.add.fields.fullName} value={dossier.fullName} />
                <KV label={t.add.fields.alias} value={dossier.alias} />
                <KV label={t.add.fields.phone} value={dossier.phone} icon={<Phone size={11} />} />
                <KV label={t.add.fields.email} value={dossier.email} icon={<Mail size={11} />} />
              </Grid>
            </ViewSection>

            <ViewSection title={t.add.sections.geolocation} icon={<MapPin size={14} />}>
              <Grid>
                <KV label={t.add.fields.country} value={dossier.country} />
                <KV label={t.add.fields.city} value={dossier.city} />
                <KV label={t.add.fields.address} value={dossier.address} colSpan={2} />
              </Grid>
            </ViewSection>

            {(dossier.socialMedia.length > 0 || dossier.knownAccounts.length > 0) && (
              <ViewSection title={t.add.sections.digital} icon={<FileText size={14} />}>
                <div className="grid sm:grid-cols-2 gap-5">
                  <Listing label={t.add.fields.socialMedia} items={dossier.socialMedia} />
                  <Listing label={t.add.fields.knownAccounts} items={dossier.knownAccounts} />
                </div>
              </ViewSection>
            )}

            {dossier.investigationSummary && (
              <ViewSection title={t.add.sections.summary}>
                <p className="font-mono text-[12.5px] leading-relaxed text-white/80 whitespace-pre-wrap">
                  {dossier.investigationSummary}
                </p>
              </ViewSection>
            )}

            {dossier.notes && (
              <ViewSection title={t.add.sections.notes}>
                <p className="font-mono text-[12.5px] leading-relaxed text-white/70 whitespace-pre-wrap">
                  {dossier.notes}
                </p>
              </ViewSection>
            )}

            {dossier.activityTimeline.length > 0 && (
              <ViewSection title={t.add.sections.timeline} icon={<Clock size={14} />}>
                <ol className="relative pl-4 space-y-2 before:absolute before:left-1 before:top-1 before:bottom-1 before:w-px before:bg-emerald-glow/30">
                  {dossier.activityTimeline.map((it, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-3 top-2 h-2 w-2 rounded-full bg-emerald-glow shadow-glow-emerald" />
                      <div className="surface p-3 flex items-start gap-3">
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-glow w-24 shrink-0">
                          {it.date}
                        </span>
                        <span className="font-mono text-[12px] flex-1">
                          {it.event}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              </ViewSection>
            )}

            {dossier.connections.length > 0 && (
              <ViewSection title={t.add.sections.connections} icon={<Users size={14} />}>
                <div className="grid sm:grid-cols-2 gap-2">
                  {dossier.connections.map((c, i) => (
                    <div
                      key={i}
                      className="surface px-3 py-2 flex items-center gap-3"
                    >
                      <div className="h-7 w-7 rounded-md bg-emerald-glow/15 border border-emerald-glow/40 grid place-items-center font-mono text-[12px] text-emerald-glow">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-mono text-[12px] text-white truncate">
                          {c.name}
                        </div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                          {c.relation}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ViewSection>
            )}

            {dossier.additionalEvidence && (
              <ViewSection title={t.add.sections.evidence}>
                <p className="font-mono text-[12.5px] leading-relaxed text-white/80 whitespace-pre-wrap">
                  {dossier.additionalEvidence}
                </p>
              </ViewSection>
            )}

            {dossier.tags.length > 0 && (
              <ViewSection title={t.add.sections.tags} icon={<Tag size={14} />}>
                <div className="flex flex-wrap gap-2">
                  {dossier.tags.map((tg) => (
                    <span
                      key={tg}
                      className="px-2 py-1 rounded font-mono text-[11px] uppercase bg-emerald-glow/[0.07] border border-emerald-glow/30 text-emerald-glow"
                    >
                      {tg}
                    </span>
                  ))}
                </div>
              </ViewSection>
            )}
          </div>
        </div>

        <div className="px-6 sm:px-10 pb-7">
          <div className="dotted-divider h-px w-full mb-3" />
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40 text-center">
            {t.add.endOfDocument}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ViewSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="flex items-center gap-3 mb-3">
        <span className="text-emerald-glow">{icon ?? "§"}</span>
        <h3 className="font-display tracking-[0.16em] uppercase text-sm text-white">
          {title}
        </h3>
        <div className="flex-1 h-px bg-white/[0.06]" />
      </header>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">{children}</div>;
}

function KV({
  label,
  value,
  icon,
  colSpan,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
  colSpan?: number;
}) {
  return (
    <div
      style={
        colSpan ? { gridColumn: `span ${colSpan} / span ${colSpan}` } : undefined
      }
    >
      <div className="label-mono flex items-center gap-1">
        {icon} {label}
      </div>
      <div className="font-mono text-[13px] text-white/85 mt-0.5 break-words">
        {value || <span className="text-white/30">—</span>}
      </div>
      <div className="mt-1 h-px bg-white/[0.06]" />
    </div>
  );
}

function Listing({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="label-mono mb-1.5">{label}</div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li
            key={i}
            className="surface px-2.5 py-1.5 font-mono text-[12px] break-all"
          >
            <span className="text-emerald-glow mr-2">▸</span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RiskBadge({ level, t }: { level: string; t: import("@/lib/i18n").Translation }) {
  const map: Record<string, string> = {
    LOW: "border-emerald-glow/40 text-emerald-glow bg-emerald-glow/[0.06]",
    MEDIUM: "border-amber-glow/40 text-amber-glow bg-amber-glow/[0.06]",
    HIGH: "border-warning/40 text-warning bg-warning/[0.06]",
    CRITICAL: "border-warning/60 text-warning bg-warning/[0.1] shadow-glow-warning",
  };
  const labelMap: Record<string, string> = {
    LOW: t.database.riskLow,
    MEDIUM: t.database.riskMedium,
    HIGH: t.database.riskHigh,
    CRITICAL: t.database.riskCritical,
  };
  return (
    <span className={`badge ${map[level] ?? ""}`}>
      <ShieldAlert size={10} /> RISK · {labelMap[level] ?? level}
    </span>
  );
}
