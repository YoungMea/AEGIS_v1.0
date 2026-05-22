"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, UserSearch, Hash, MessageSquare } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { UserSearchResult } from "../types";

interface FindProps {
  currentUid: string;
  onMessageOperative?: (id: string) => void;
}

export function FindFriendsSection({
  currentUid,
  onMessageOperative,
}: FindProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setTouched(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(query.trim())}`,
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.results);
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div className="pt-6 max-w-3xl mx-auto">
      <div className="text-center">
        <div className="badge inline-flex mb-3">{t.find.badge}</div>
        <h1 className="font-display tracking-[0.16em] uppercase text-2xl sm:text-3xl text-white">
          {t.find.titlePart1}{" "}
          <span className="text-emerald-glow text-glow">
            {t.find.titlePart2}
          </span>
        </h1>
        <p className="text-white/45 text-xs mt-2 max-w-md mx-auto">
          {t.find.subtitle}
        </p>
      </div>

      <div className="mt-7 relative">
        <div className="absolute -inset-px rounded-xl bg-gradient-to-r from-emerald-glow/30 via-transparent to-emerald-glow/10 blur-xl opacity-50" />
        <div className="relative surface-strong p-2 flex items-center gap-2">
          <span className="pl-3 text-emerald-glow">
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Search size={16} />
            )}
          </span>
          <input
            value={query}
            onChange={(e) =>
              setQuery(e.target.value.slice(0, 80))
            }
            placeholder={t.find.placeholder}
            className="flex-1 bg-transparent border-0 outline-none px-2 py-2.5 font-mono tracking-[0.18em] text-base"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-white/40 hover:text-white px-2 font-mono text-xs uppercase tracking-[0.18em]"
            >
              {t.find.clear}
            </button>
          )}
        </div>
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/30 text-center">
          {t.find.hint}
        </div>
      </div>

      <div className="mt-6">
        <AnimatePresence mode="wait">
          {!touched && (
            <motion.div
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="surface p-8 text-center"
            >
              <UserSearch size={28} className="mx-auto text-emerald-glow/60" />
              <div className="mt-2 text-white/55 text-sm">
                {t.find.searchHintEmpty}
              </div>
            </motion.div>
          )}

          {touched && !loading && results.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="surface p-8 text-center"
            >
              <div className="text-white/55 text-sm">
                {t.find.noMatch}{" "}
                <span className="font-mono text-white">UID {query}</span>
              </div>
            </motion.div>
          )}

          {results.length > 0 && (
            <motion.ul
              key="results"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {results.map((u, i) => (
                <motion.li
                  key={u.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <ResultCard
                    user={u}
                    isSelf={u.uid === currentUid}
                    onMessage={
                      onMessageOperative && u.uid !== currentUid
                        ? () => onMessageOperative(u.id)
                        : undefined
                    }
                  />
                </motion.li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ResultCard({
  user,
  isSelf,
  onMessage,
}: {
  user: UserSearchResult;
  isSelf: boolean;
  onMessage?: () => void;
}) {
  const { t } = useI18n();
  const initial =
    (user.displayName ?? user.uid).replace(/[^A-Za-z0-9]/g, "").charAt(0).toUpperCase() ||
    "A";
  return (
    <div className="surface-strong px-4 py-3 flex items-center gap-4 hover:bg-white/[0.04] transition">
      <div className="relative">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt=""
            className="h-12 w-12 rounded-md object-cover border border-white/10"
          />
        ) : (
          <div className="h-12 w-12 rounded-md bg-emerald-glow/15 border border-emerald-glow/40 grid place-items-center font-mono text-emerald-glow text-lg">
            {initial}
          </div>
        )}
        <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-emerald-glow border-2 border-ink-50 animate-pulseDot" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-white font-medium truncate">
            {user.displayName ?? t.find.operative}
          </div>
          {isSelf && <span className="badge-ok">{t.find.you}</span>}
        </div>
        <div className="font-mono text-[11px] text-white/40 flex items-center gap-2 mt-0.5">
          <Hash size={10} />
          UID {user.uid}
          <span className="text-white/20">·</span>
          {t.find.enrolled} {formatDate(user.createdAt)}
        </div>
      </div>

      {onMessage && (
        <button
          type="button"
          onClick={onMessage}
          className="btn-ghost h-9 px-3 text-[11px] uppercase tracking-[0.18em] font-mono shrink-0"
        >
          <MessageSquare size={12} />
          <span className="hidden sm:inline">{t.find.message}</span>
        </button>
      )}

      <div className="hidden sm:flex flex-col items-end font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
        <span>{t.add.statusLabel}</span>
        <span className="text-emerald-glow">{t.find.statusActive}</span>
      </div>
    </div>
  );
}
