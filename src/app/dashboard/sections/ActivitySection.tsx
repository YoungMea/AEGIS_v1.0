"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ScrollText,
  Folder,
  Eye,
  Pencil,
  Trash2,
  KeyRound,
  LogIn,
  LogOut,
  MessageSquare,
  UserCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn, formatDate } from "@/lib/utils";

interface Entry {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  summary: string | null;
  ip: string | null;
  createdAt: number;
}

const PAGE = 50;

export function ActivitySection() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/audit?limit=${PAGE}`);
      if (!res.ok) return;
      const data = await res.json();
      setEntries(data.entries);
      setExhausted((data.entries as Entry[]).length < PAGE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function loadMore() {
    if (entries.length === 0 || exhausted || loadingMore) return;
    setLoadingMore(true);
    try {
      const cursor = entries[entries.length - 1]!.createdAt;
      const res = await fetch(
        `/api/audit?before=${cursor}&limit=${PAGE}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      const incoming = data.entries as Entry[];
      setEntries((arr) => [...arr, ...incoming]);
      if (incoming.length < PAGE) setExhausted(true);
    } finally {
      setLoadingMore(false);
    }
  }

  const groups = useMemo(() => groupByDay(entries), [entries]);

  return (
    <div className="pt-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5 gap-3">
        <div>
          <div className="badge inline-flex">
            <ScrollText size={11} /> {t.activity.badge}
          </div>
          <h1 className="font-display tracking-[0.16em] uppercase text-2xl sm:text-3xl text-white mt-2">
            {t.activity.titlePart1}{" "}
            <span className="text-emerald-glow text-glow">
              {t.activity.titlePart2}
            </span>
          </h1>
          <p className="text-white/45 text-xs mt-1.5 max-w-md">
            {t.activity.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="btn-ghost h-9 text-[11px] uppercase tracking-[0.18em] font-mono shrink-0"
        >
          <RefreshCw
            size={12}
            className={loading ? "animate-spin" : ""}
          />
        </button>
      </div>

      {loading && entries.length === 0 ? (
        <div className="surface p-8 text-center">
          <Loader2 size={20} className="mx-auto animate-spin text-emerald-glow" />
        </div>
      ) : entries.length === 0 ? (
        <div className="surface p-8 text-center">
          <ScrollText size={28} className="mx-auto text-emerald-glow/60" />
          <div className="mt-2 text-white/55 text-sm">{t.activity.empty}</div>
        </div>
      ) : (
        <div className="space-y-7">
          {groups.map((g) => (
            <section key={g.label}>
              <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40 mb-2">
                ▸ {g.label}
              </h2>
              <ol className="relative pl-4 space-y-2 before:absolute before:left-1 before:top-1 before:bottom-1 before:w-px before:bg-emerald-glow/25">
                {g.entries.map((e, i) => (
                  <motion.li
                    key={e.id}
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18, delay: Math.min(i, 6) * 0.02 }}
                    className="relative"
                  >
                    <span className="absolute -left-3 top-2 h-2 w-2 rounded-full bg-emerald-glow shadow-glow-emerald" />
                    <Row entry={e} />
                  </motion.li>
                ))}
              </ol>
            </section>
          ))}

          {!exhausted && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="btn-ghost h-9 text-[11px] uppercase tracking-[0.18em] font-mono"
              >
                {loadingMore ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : null}
                {t.activity.loadMore}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ entry }: { entry: Entry }) {
  const { t } = useI18n();
  const meta = ACTIONS[entry.action] ?? GENERIC;
  const labelKey = meta.label as keyof typeof t.activity;
  const label = (t.activity as Record<string, string>)[labelKey] ?? entry.action;
  return (
    <div className="surface px-3.5 py-2.5 flex items-start gap-3">
      <div
        className={cn(
          "h-8 w-8 shrink-0 rounded-md grid place-items-center border",
          meta.tone === "warning"
            ? "bg-warning/[0.08] border-warning/40 text-warning"
            : meta.tone === "amber"
              ? "bg-amber-glow/[0.08] border-amber-glow/40 text-amber-glow"
              : "bg-emerald-glow/[0.08] border-emerald-glow/40 text-emerald-glow",
        )}
      >
        {meta.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[13px] text-white">{label}</span>
          {entry.summary && (
            <span className="font-mono text-[11px] text-white/55 truncate">
              · {entry.summary}
            </span>
          )}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35 mt-0.5">
          {formatDate(entry.createdAt, true)}
          {entry.ip && entry.ip !== "0.0.0.0" && (
            <>
              <span className="mx-1.5">·</span>IP {entry.ip}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface ActionMeta {
  label: string;
  icon: React.ReactNode;
  tone: "emerald" | "amber" | "warning";
}

const ACTIONS: Record<string, ActionMeta> = {
  "auth.login": { label: "actionLogin", icon: <LogIn size={14} />, tone: "emerald" },
  "auth.logout": { label: "actionLogout", icon: <LogOut size={14} />, tone: "amber" },
  "auth.password_changed": {
    label: "actionPasswordChanged",
    icon: <KeyRound size={14} />,
    tone: "amber",
  },
  "auth.profile_updated": {
    label: "actionProfileUpdated",
    icon: <UserCircle size={14} />,
    tone: "emerald",
  },
  "dossier.created": {
    label: "actionDossierCreated",
    icon: <Folder size={14} />,
    tone: "emerald",
  },
  "dossier.updated": {
    label: "actionDossierUpdated",
    icon: <Pencil size={14} />,
    tone: "emerald",
  },
  "dossier.viewed": {
    label: "actionDossierViewed",
    icon: <Eye size={14} />,
    tone: "emerald",
  },
  "dossier.deleted": {
    label: "actionDossierDeleted",
    icon: <Trash2 size={14} />,
    tone: "warning",
  },
  "chat.sent": {
    label: "actionMessageSent",
    icon: <MessageSquare size={14} />,
    tone: "emerald",
  },
};

const GENERIC: ActionMeta = {
  label: "",
  icon: <ScrollText size={14} />,
  tone: "emerald",
};

interface DayGroup {
  label: string;
  entries: Entry[];
}

function groupByDay(entries: Entry[]): DayGroup[] {
  const map = new Map<string, Entry[]>();
  for (const e of entries) {
    const key = new Date(e.createdAt).toISOString().slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries()).map(([label, list]) => ({
    label,
    entries: list,
  }));
}
