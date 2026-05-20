"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Save,
  Printer,
  FileDown,
  Archive,
  X,
  Upload,
  ImagePlus,
  Plus,
  Trash2,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import type { Dossier } from "@/lib/dossier";
import type { SessionUserDto } from "../types";
import { Barcode } from "@/components/ui/Barcode";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Translation } from "@/lib/i18n";
import { cn, formatDate } from "@/lib/utils";

interface Props {
  user: SessionUserDto;
  editing: Dossier | null;
  onCancel: () => void;
  onSaved: (saved: Dossier) => void;
}

interface FormState {
  classification: "UNCLASSIFIED" | "CONFIDENTIAL" | "SECRET" | "TOP SECRET";
  status: "ACTIVE" | "ARCHIVED" | "PENDING" | "CLOSED";
  targetImage: string | null;
  fullName: string;
  alias: string;
  phone: string;
  email: string;
  country: string;
  city: string;
  address: string;
  socialMedia: string[];
  knownAccounts: string[];
  notes: string;
  investigationSummary: string;
  activityTimeline: { date: string; event: string }[];
  connections: { name: string; relation: string }[];
  additionalEvidence: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  tags: string[];
}

const empty: FormState = {
  classification: "CONFIDENTIAL",
  status: "ACTIVE",
  targetImage: null,
  fullName: "",
  alias: "",
  phone: "",
  email: "",
  country: "",
  city: "",
  address: "",
  socialMedia: [],
  knownAccounts: [],
  notes: "",
  investigationSummary: "",
  activityTimeline: [],
  connections: [],
  additionalEvidence: "",
  riskLevel: "LOW",
  tags: [],
};

export function AddSection({ user, editing, onCancel, onSaved }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [scanning, setScanning] = useState(true);

  // Bootstrap form values from editing dossier.
  useEffect(() => {
    if (editing) {
      setForm({
        classification: editing.classification as FormState["classification"],
        status: editing.status as FormState["status"],
        targetImage: editing.targetImage,
        fullName: editing.fullName ?? "",
        alias: editing.alias ?? "",
        phone: editing.phone ?? "",
        email: editing.email ?? "",
        country: editing.country ?? "",
        city: editing.city ?? "",
        address: editing.address ?? "",
        socialMedia: editing.socialMedia ?? [],
        knownAccounts: editing.knownAccounts ?? [],
        notes: editing.notes ?? "",
        investigationSummary: editing.investigationSummary ?? "",
        activityTimeline: editing.activityTimeline ?? [],
        connections: editing.connections ?? [],
        additionalEvidence: editing.additionalEvidence ?? "",
        riskLevel: editing.riskLevel as FormState["riskLevel"],
        tags: editing.tags ?? [],
      });
    } else {
      setForm(empty);
    }
    setScanning(true);
    const t = setTimeout(() => setScanning(false), 1200);
    return () => clearTimeout(t);
  }, [editing]);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function save(opts?: { archive?: boolean }) {
    setBusy(true);
    try {
      const payload = {
        ...form,
        status: opts?.archive ? "ARCHIVED" : form.status,
        // Coerce empty strings to null for optional fields the API accepts as nullable
        fullName: form.fullName || null,
        alias: form.alias || null,
        phone: form.phone || null,
        email: form.email || null,
        country: form.country || null,
        city: form.city || null,
        address: form.address || null,
        notes: form.notes || null,
        investigationSummary: form.investigationSummary || null,
        additionalEvidence: form.additionalEvidence || null,
      };
      const res = editing
        ? await fetch(`/api/dossiers/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/dossiers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.push({
          type: "error",
          title: t.add.couldNotSave,
          message: err.error ?? t.common.invalidInput,
        });
        return;
      }
      const data = await res.json();
      onSaved(data.dossier);
    } catch {
      toast.push({ type: "error", title: t.common.networkError });
    } finally {
      setBusy(false);
    }
  }

  const ref = useMemo(
    () => `AGS-${(editing?.id ?? "PENDING").slice(-8).toUpperCase()}`,
    [editing],
  );

  function exportPdf() {
    window.print();
  }

  return (
    <div className="pt-5 pb-24">
      {/* Toolbar */}
      <div className="no-print sticky top-[112px] sm:top-[108px] z-30 surface-strong px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="badge">
          {editing ? t.add.badgeEditing : t.add.badgeNew}
        </div>
        <div className="font-mono text-[11px] text-white/50 truncate">
          REF · {ref} · {t.add.operator} {user.uid}
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <button
            onClick={onCancel}
            className="btn-ghost h-9 text-xs uppercase tracking-[0.18em] font-mono"
          >
            <X size={14} /> {t.common.cancel}
          </button>
          <button
            onClick={exportPdf}
            className="btn-ghost h-9 text-xs uppercase tracking-[0.18em] font-mono"
          >
            <Printer size={14} /> {t.common.print}
          </button>
          <button
            onClick={exportPdf}
            className="btn-ghost h-9 text-xs uppercase tracking-[0.18em] font-mono"
          >
            <FileDown size={14} /> {t.common.exportPdf}
          </button>
          <button
            onClick={() => save({ archive: true })}
            disabled={busy}
            className="btn-ghost h-9 text-xs uppercase tracking-[0.18em] font-mono"
          >
            <Archive size={14} /> {t.common.archive}
          </button>
          <button
            onClick={() => save()}
            disabled={busy}
            className="btn-primary h-9"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {busy ? t.common.saving : t.common.save}
          </button>
        </div>
      </div>

      {/* Document */}
      <div className="mt-6 paper rounded-xl">
        {/* Top decorative bar */}
        <div className="relative px-6 sm:px-10 pt-8 pb-4 border-b border-white/[0.06]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-glow/50 to-transparent" />
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
                {process.env.NEXT_PUBLIC_AGENCY_FULL ?? "Advanced Electronic General Intelligence Service"}
              </div>
              <h2 className="font-display tracking-[0.18em] uppercase text-2xl sm:text-3xl text-white mt-1">
                {t.add.headingDossier}
              </h2>
              <div className="mt-2 flex gap-2 flex-wrap">
                <select
                  value={form.classification}
                  onChange={(e) => set("classification", e.target.value as FormState["classification"])}
                  className="badge bg-warning/[0.06] border-warning/30 text-warning cursor-pointer"
                  aria-label="Classification"
                >
                  <option className="bg-ink-100">UNCLASSIFIED</option>
                  <option className="bg-ink-100">CONFIDENTIAL</option>
                  <option className="bg-ink-100">SECRET</option>
                  <option className="bg-ink-100">TOP SECRET</option>
                </select>
                <span className="badge">REF · {ref}</span>
                <span className="badge">{t.add.operator} · {user.uid}</span>
              </div>
            </div>
            <div className="flex items-end gap-4">
              <div className="hidden sm:block">
                <Barcode value={ref} />
              </div>
              <div className="stamp">{t.add.classified}</div>
            </div>
          </div>
        </div>

        {/* Body grid */}
        <div className="px-6 sm:px-10 py-8 grid lg:grid-cols-[260px_1fr] gap-8">
          {/* Left column — image + meta */}
          <div className="space-y-5">
            <div className="relative">
              <ImageUploader
                value={form.targetImage}
                onChange={(v) => set("targetImage", v)}
                t={t}
              />
              {scanning && (
                <motion.div
                  initial={{ y: "-10%" }}
                  animate={{ y: "110%" }}
                  transition={{ duration: 1.2, ease: "linear" }}
                  className="pointer-events-none absolute inset-x-0 h-12 bg-gradient-to-b from-transparent via-emerald-glow/40 to-transparent blur-md"
                />
              )}
            </div>

            <SelectField
              label={t.add.statusLabel}
              value={form.status}
              onChange={(v) => set("status", v as FormState["status"])}
              options={["ACTIVE", "PENDING", "ARCHIVED", "CLOSED"]}
            />
            <SelectField
              label={t.add.riskLabel}
              value={form.riskLevel}
              onChange={(v) => set("riskLevel", v as FormState["riskLevel"])}
              options={["LOW", "MEDIUM", "HIGH", "CRITICAL"]}
              accentByValue={{
                LOW: "text-emerald-glow border-emerald-glow/40",
                MEDIUM: "text-amber-glow border-amber-glow/40",
                HIGH: "text-warning border-warning/40",
                CRITICAL: "text-warning border-warning/60",
              }}
            />
            <Meta
              items={[
                [t.add.agent, user.displayName ?? "OPERATIVE"],
                ["UID", user.uid],
                [t.add.created, editing ? formatDate(editing.createdAt) : t.add.pending],
                [t.add.updated, editing ? formatDate(editing.updatedAt) : "—"],
              ]}
            />
          </div>

          {/* Right column — fields */}
          <div className="space-y-7">
            <Section title={t.add.sections.subject}>
              <div className="grid sm:grid-cols-2 gap-4">
                <DocField label={t.add.fields.fullName}>
                  <input
                    className="docinput"
                    value={form.fullName}
                    onChange={(e) => set("fullName", e.target.value)}
                    placeholder={t.add.fields.fullNamePh}
                  />
                </DocField>
                <DocField label={t.add.fields.alias}>
                  <input
                    className="docinput"
                    value={form.alias}
                    onChange={(e) => set("alias", e.target.value)}
                    placeholder={t.add.fields.aliasPh}
                  />
                </DocField>
                <DocField label={t.add.fields.phone}>
                  <input
                    className="docinput"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder={t.add.fields.phonePh}
                  />
                </DocField>
                <DocField label={t.add.fields.email}>
                  <input
                    type="email"
                    className="docinput"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder={t.add.fields.emailPh}
                  />
                </DocField>
              </div>
            </Section>

            <Section title={t.add.sections.geolocation}>
              <div className="grid sm:grid-cols-3 gap-4">
                <DocField label={t.add.fields.country}>
                  <input
                    className="docinput"
                    value={form.country}
                    onChange={(e) => set("country", e.target.value)}
                  />
                </DocField>
                <DocField label={t.add.fields.city}>
                  <input
                    className="docinput"
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                  />
                </DocField>
                <DocField label={t.add.fields.address}>
                  <input
                    className="docinput"
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                  />
                </DocField>
              </div>
            </Section>

            <Section title={t.add.sections.digital}>
              <div className="grid sm:grid-cols-2 gap-6">
                <ListField
                  label={t.add.fields.socialMedia}
                  items={form.socialMedia}
                  onChange={(v) => set("socialMedia", v)}
                  placeholder={t.add.fields.socialPh}
                />
                <ListField
                  label={t.add.fields.knownAccounts}
                  items={form.knownAccounts}
                  onChange={(v) => set("knownAccounts", v)}
                  placeholder={t.add.fields.knownPh}
                />
              </div>
            </Section>

            <Section title={t.add.sections.summary}>
              <DocField>
                <textarea
                  rows={4}
                  className="docinput resize-none"
                  value={form.investigationSummary}
                  onChange={(e) => set("investigationSummary", e.target.value)}
                  placeholder={t.add.fields.summaryPh}
                />
              </DocField>
            </Section>

            <Section title={t.add.sections.notes}>
              <DocField>
                <textarea
                  rows={3}
                  className="docinput resize-none"
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder={t.add.fields.notesPh}
                />
              </DocField>
            </Section>

            <Section title={t.add.sections.timeline}>
              <TimelineField
                items={form.activityTimeline}
                onChange={(v) => set("activityTimeline", v)}
                t={t}
              />
            </Section>

            <Section title={t.add.sections.connections}>
              <ConnectionsField
                items={form.connections}
                onChange={(v) => set("connections", v)}
                t={t}
              />
            </Section>

            <Section title={t.add.sections.evidence}>
              <DocField>
                <textarea
                  rows={3}
                  className="docinput resize-none"
                  value={form.additionalEvidence}
                  onChange={(e) => set("additionalEvidence", e.target.value)}
                  placeholder={t.add.fields.evidencePh}
                />
              </DocField>
            </Section>

            <Section title={t.add.sections.tags}>
              <TagsField
                items={form.tags}
                onChange={(v) => set("tags", v)}
                t={t}
              />
            </Section>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 sm:px-10 pb-8 pt-2">
          <div className="dotted-divider h-px w-full mb-4" />
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
              {t.add.endOfDocument}
            </div>
            <div className="flex items-center gap-3">
              <span className="badge"><ShieldAlert size={10}/> {form.classification}</span>
              <Barcode value={ref} height={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Inline styles for typewriter inputs */}
      <style jsx>{`
        :global(.docinput) {
          width: 100%;
          background: transparent;
          border: 0;
          border-bottom: 1px dashed rgba(255, 255, 255, 0.12);
          padding: 0.4rem 0;
          font-family: var(--font-jetbrains), monospace;
          font-size: 0.86rem;
          color: white;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        :global(.docinput::placeholder) {
          color: rgba(255, 255, 255, 0.22);
        }
        :global(.docinput:focus) {
          border-bottom-color: rgba(16, 245, 168, 0.7);
          box-shadow: 0 1px 0 0 rgba(16, 245, 168, 0.4);
        }
      `}</style>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="flex items-center gap-3 mb-3">
        <span className="font-display tracking-[0.18em] uppercase text-[11px] text-emerald-glow">
          §
        </span>
        <h3 className="font-display tracking-[0.16em] uppercase text-sm text-white">
          {title}
        </h3>
        <div className="flex-1 h-px bg-white/[0.06]" />
      </header>
      {children}
    </section>
  );
}

function DocField({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      {label && <div className="label-mono mb-1">{label}</div>}
      {children}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  accentByValue,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  accentByValue?: Record<string, string>;
}) {
  const accent = accentByValue?.[value];
  return (
    <div>
      <div className="label-mono mb-1">{label}</div>
      <div
        className={cn(
          "rounded-md border px-2.5 py-2",
          accent ?? "border-white/10 text-white/80",
        )}
      >
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent outline-none font-mono text-[12px] tracking-[0.18em]"
        >
          {options.map((o) => (
            <option key={o} className="bg-ink-100">
              {o}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Meta({ items }: { items: [string, string][] }) {
  return (
    <div className="surface p-3 grid grid-cols-2 gap-y-2 gap-x-3 font-mono text-[11px]">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <div className="label-mono">{k}</div>
          <div className="text-right text-white/80 truncate">{v}</div>
        </div>
      ))}
    </div>
  );
}

function ImageUploader({
  value,
  onChange,
  t,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  t: Translation;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [drag, setDrag] = useState(false);

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 4 * 1024 * 1024) {
      alert(t.add.imageTooLarge);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
      className={cn(
        "relative aspect-[4/5] rounded-md border overflow-hidden",
        drag
          ? "border-emerald-glow/60 shadow-glow-emerald"
          : "border-white/10 bg-ink-200",
      )}
    >
      {value ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Target"
            className="h-full w-full object-cover saturate-[0.85] contrast-110"
          />
          <div className="absolute inset-0 ring-1 ring-emerald-glow/30" />
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
            <span className="badge bg-warning/[0.08] border-warning/30 text-warning">
              {t.add.subjectStamp}
            </span>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="h-6 w-6 grid place-items-center rounded bg-black/60 text-white/70 hover:text-warning"
            >
              <X size={12} />
            </button>
          </div>
          <div className="absolute bottom-2 inset-x-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 flex items-center justify-between">
            <span>OPTICS</span>
            <span>16:20:11Z</span>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="h-full w-full grid place-items-center text-white/45 hover:text-white transition"
        >
          <div className="text-center">
            <ImagePlus size={28} className="mx-auto text-emerald-glow/60" />
            <div className="mt-2 text-xs">{t.add.uploadTitle}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] mt-1 text-white/35">
              {t.add.uploadHint}
            </div>
          </div>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.currentTarget.value = "";
        }}
      />

      {!value && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute bottom-2 left-2 right-2 btn-ghost h-8 text-[10px] uppercase tracking-[0.18em] font-mono"
        >
          <Upload size={12} /> {t.add.uploadBrowse}
        </button>
      )}
    </div>
  );
}

function ListField({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  }
  return (
    <div>
      <div className="label-mono mb-2">{label}</div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="docinput flex-1"
          placeholder={placeholder}
        />
        <button onClick={add} type="button" className="btn-ghost h-8 px-3">
          <Plus size={14} />
        </button>
      </div>
      {items.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {items.map((it, i) => (
            <li
              key={`${it}-${i}`}
              className="flex items-center gap-2 surface px-2.5 py-1.5"
            >
              <span className="font-mono text-[11px] text-emerald-glow">▸</span>
              <span className="font-mono text-[12px] flex-1 break-all">{it}</span>
              <button
                onClick={() =>
                  onChange(items.filter((_, ix) => ix !== i))
                }
                type="button"
                className="text-white/40 hover:text-warning"
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TimelineField({
  items,
  onChange,
  t,
}: {
  items: { date: string; event: string }[];
  onChange: (v: { date: string; event: string }[]) => void;
  t: Translation;
}) {
  const [date, setDate] = useState("");
  const [event, setEvent] = useState("");
  function add() {
    if (!event.trim()) return;
    onChange([
      ...items,
      { date: date || new Date().toISOString().slice(0, 10), event: event.trim() },
    ]);
    setDate("");
    setEvent("");
  }
  return (
    <div>
      <div className="grid sm:grid-cols-[160px_1fr_auto] gap-2 items-end">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="docinput"
        />
        <input
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={t.add.fields.eventPh}
          className="docinput"
        />
        <button type="button" onClick={add} className="btn-ghost h-9 px-3">
          <Plus size={14} />
        </button>
      </div>
      {items.length > 0 && (
        <ol className="mt-3 relative pl-4 space-y-2 before:absolute before:left-1 before:top-1 before:bottom-1 before:w-px before:bg-emerald-glow/30">
          {items.map((it, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-3 top-2 h-2 w-2 rounded-full bg-emerald-glow shadow-glow-emerald" />
              <div className="surface p-3 flex items-start gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-glow w-24 shrink-0">
                  {it.date}
                </span>
                <span className="font-mono text-[12px] flex-1">{it.event}</span>
                <button
                  onClick={() => onChange(items.filter((_, ix) => ix !== i))}
                  type="button"
                  className="text-white/40 hover:text-warning"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ConnectionsField({
  items,
  onChange,
  t,
}: {
  items: { name: string; relation: string }[];
  onChange: (v: { name: string; relation: string }[]) => void;
  t: Translation;
}) {
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  function add() {
    if (!name.trim()) return;
    onChange([
      ...items,
      { name: name.trim(), relation: relation.trim() || "associate" },
    ]);
    setName("");
    setRelation("");
  }
  return (
    <div>
      <div className="grid sm:grid-cols-[1fr_180px_auto] gap-2 items-end">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.add.fields.personPh}
          className="docinput"
        />
        <input
          value={relation}
          onChange={(e) => setRelation(e.target.value)}
          placeholder={t.add.fields.relationPh}
          className="docinput"
        />
        <button type="button" onClick={add} className="btn-ghost h-9 px-3">
          <Plus size={14} />
        </button>
      </div>
      {items.length > 0 && (
        <div className="mt-3 grid sm:grid-cols-2 gap-2">
          {items.map((it, i) => (
            <div
              key={i}
              className="surface px-3 py-2 flex items-center gap-3"
            >
              <div className="h-7 w-7 rounded-md bg-emerald-glow/15 border border-emerald-glow/40 grid place-items-center font-mono text-[12px] text-emerald-glow">
                {it.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-mono text-[12px] text-white truncate">
                  {it.name}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                  {it.relation}
                </div>
              </div>
              <button
                onClick={() => onChange(items.filter((_, ix) => ix !== i))}
                type="button"
                className="ml-auto text-white/40 hover:text-warning"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TagsField({
  items,
  onChange,
  t,
}: {
  items: string[];
  onChange: (v: string[]) => void;
  t: Translation;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim().toUpperCase().replace(/\s+/g, "_");
    if (!v) return;
    if (items.includes(v)) return;
    onChange([...items, v]);
    setDraft("");
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded font-mono text-[11px] uppercase bg-emerald-glow/[0.07] border border-emerald-glow/30 text-emerald-glow"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(items.filter((x) => x !== tag))}
            className="text-emerald-glow/60 hover:text-warning"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        placeholder={t.add.fields.tagPh}
        className="docinput max-w-[180px]"
      />
    </div>
  );
}
