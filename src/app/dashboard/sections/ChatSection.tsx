"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Search,
  Loader2,
  Send,
  Paperclip,
  FileText,
  Lock,
  ShieldCheck,
  ArrowLeft,
  X,
  Folder,
  Download,
  ShieldAlert,
} from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import { cn, formatDate } from "@/lib/utils";
import { useChatStream } from "@/hooks/useChatStream";
import type { ChatMessage, ConversationSummary, DossierSnapshot } from "@/lib/chat";
import type { Dossier } from "@/lib/dossier";
import type { SessionUserDto, UserSearchResult } from "../types";

interface Props {
  user: SessionUserDto;
  dossiers: Dossier[];
  openPeerId?: string | null;
  onConsumed?: () => void;
  onUnreadChange?: (n: number) => void;
}

type ActivePeer = ConversationSummary["peer"];

export function ChatSection({
  user,
  dossiers,
  openPeerId,
  onConsumed,
  onUnreadChange,
}: Props) {
  const { t } = useI18n();
  const toast = useToast();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePeer, setActivePeer] = useState<ActivePeer | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  // Real-time push channel (SSE). When a message arrives:
  //  - if it belongs to the open thread, append it inline
  //  - always refresh the conversation list so previews & unread bubbles update
  const activePeerIdRef = useRef<string | null>(null);
  activePeerIdRef.current = activePeer?.id ?? null;

  const { status: streamStatus, onlineSet } = useChatStream({
    onMessage: (msg) => {
      const peerId = activePeerIdRef.current;
      if (
        peerId &&
        (msg.senderId === peerId || msg.recipientId === peerId)
      ) {
        setMessages((prev) => {
          // Avoid duplicates if the optimistic POST response arrived first.
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Mark inbound peers' messages read on arrival, since the thread is open.
        if (msg.senderId === peerId) {
          fetch(`/api/chat/threads/${encodeURIComponent(peerId)}`).catch(() => {});
        }
      }
      // Always refresh list so previews and unread counters stay correct.
      void refreshConversations();
    },
  });

  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations");
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations);
      onUnreadChange?.(data.unread ?? 0);
    } finally {
      setLoading(false);
    }
  }, [onUnreadChange]);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  // If parent passed an openPeerId (e.g. clicked "Message" in Find Friends),
  // resolve it to a peer object and open the thread once conversations load.
  useEffect(() => {
    if (!openPeerId) return;
    let cancelled = false;
    (async () => {
      // Try existing conversations first.
      const existing = conversations.find((c) => c.peer.id === openPeerId);
      if (existing) {
        if (!cancelled) {
          setActivePeer(existing.peer);
          onConsumed?.();
        }
        return;
      }
      // Otherwise fetch a thread directly — backend creates the peer record.
      try {
        const res = await fetch(`/api/chat/threads/${encodeURIComponent(openPeerId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setActivePeer(data.peer);
          setMessages(data.messages);
          onConsumed?.();
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openPeerId, conversations, onConsumed]);

  // Lazy poll the conversation list as a fallback in case SSE stalls
  // (Render cold-start, network blip, etc.). The interval is intentionally
  // long because real-time updates already arrive over SSE.
  useEffect(() => {
    const id = setInterval(refreshConversations, 60_000);
    return () => clearInterval(id);
  }, [refreshConversations]);

  // Load thread whenever active peer changes. SSE pushes new messages, so
  // we only need a single fetch on open + a slow safety poll.
  useEffect(() => {
    if (!activePeer) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function pull() {
      try {
        setThreadLoading(true);
        const res = await fetch(
          `/api/chat/threads/${encodeURIComponent(activePeer!.id)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setMessages(data.messages);
      } finally {
        if (!cancelled) setThreadLoading(false);
        // Slow fallback in case the stream is asleep.
        if (!cancelled) timer = setTimeout(pull, 30_000);
      }
    }
    pull();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activePeer]);

  function openPeer(peer: ActivePeer) {
    setActivePeer(peer);
    setMessages([]);
  }

  async function sendText(text: string) {
    if (!activePeer) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "text",
          recipientId: activePeer.id,
          text: trimmed,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.push({
          type: "error",
          title: t.chat.sendError,
          message: data.error,
        });
        return;
      }
      setMessages((arr) => [...arr, data.message]);
      refreshConversations();
    } catch {
      toast.push({ type: "error", title: t.chat.sendError });
    }
  }

  async function sendFile(file: File) {
    if (!activePeer) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.push({ type: "error", title: t.chat.fileTooBig });
      return;
    }
    const dataBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const r = reader.result as string;
        resolve(r.split(",")[1] ?? "");
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "file",
          recipientId: activePeer.id,
          file: {
            name: file.name,
            mime: file.type || "application/octet-stream",
            size: file.size,
            dataBase64,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.push({
          type: "error",
          title: t.chat.sendError,
          message: data.error,
        });
        return;
      }
      setMessages((arr) => [...arr, data.message]);
      refreshConversations();
    } catch {
      toast.push({ type: "error", title: t.chat.sendError });
    }
  }

  async function sendDossier(dossierId: string) {
    if (!activePeer) return;
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "dossier",
          recipientId: activePeer.id,
          dossierId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.push({
          type: "error",
          title: t.chat.sendError,
          message: data.error,
        });
        return;
      }
      setMessages((arr) => [...arr, data.message]);
      refreshConversations();
    } catch {
      toast.push({ type: "error", title: t.chat.sendError });
    }
  }

  return (
    <div className="pt-4 sm:pt-6">
      <header className="mb-4 sm:mb-5">
        <div className="badge inline-flex">
          <Lock size={11} /> {t.chat.badge}
        </div>
        <h1 className="font-display tracking-[0.16em] uppercase text-2xl sm:text-3xl text-white mt-2">
          {t.chat.titlePart1}
          <span className="text-emerald-glow text-glow">{t.chat.titlePart2}</span>
        </h1>
        <p className="text-white/45 text-xs mt-1.5 max-w-xl">
          {t.chat.subtitle}
        </p>
      </header>

      <div className="grid lg:grid-cols-[320px_1fr] gap-4 surface-strong p-2 sm:p-3 min-h-[60vh]">
        {/* Left: list */}
        <aside
          className={cn(
            "flex flex-col gap-2 lg:border-r lg:border-white/[0.06] lg:pr-3 min-h-[40vh]",
            activePeer && "hidden lg:flex",
          )}
        >
          <PeerSearch
            currentId={user.id}
            onPick={(peer) => openPeer(peer)}
          />

          <div className="flex-1 overflow-y-auto pr-1">
            {loading && (
              <div className="px-3 py-6 text-white/40 text-xs font-mono uppercase tracking-[0.18em] flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" />
                {t.chat.listLoading}
              </div>
            )}
            {!loading && conversations.length === 0 && (
              <div className="px-3 py-6 text-white/45 text-xs">
                {t.chat.listEmpty}
              </div>
            )}
            {conversations.map((c) => (
              <ConversationRow
                key={c.conversationKey}
                conv={c}
                active={activePeer?.id === c.peer.id}
                youLabel={t.chat.you}
                online={onlineSet.has(c.peer.id)}
                onPick={() => openPeer(c.peer)}
              />
            ))}
          </div>

          <div className="px-3 py-2 border-t border-white/[0.06] flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={11} className="text-emerald-glow" />
              {t.chat.encryptedNote}
            </span>
            <span
              className={cn(
                "flex items-center gap-1",
                streamStatus === "open"
                  ? "text-emerald-glow"
                  : streamStatus === "connecting"
                    ? "text-amber-glow"
                    : "text-white/30",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  streamStatus === "open"
                    ? "bg-emerald-glow animate-pulseDot"
                    : streamStatus === "connecting"
                      ? "bg-amber-glow"
                      : "bg-white/30",
                )}
              />
              {streamStatus === "open" ? "LIVE" : streamStatus.toUpperCase()}
            </span>
          </div>
        </aside>

        {/* Right: thread */}
        <section
          className={cn(
            "flex flex-col min-h-[60vh]",
            !activePeer && "hidden lg:flex",
          )}
        >
          {!activePeer ? (
            <ThreadEmpty label={t.chat.pickConversation} />
          ) : (
            <Thread
              user={user}
              peer={activePeer}
              messages={messages}
              threadLoading={threadLoading}
              dossiers={dossiers}
              peerOnline={onlineSet.has(activePeer.id)}
              onClose={() => setActivePeer(null)}
              onSendText={sendText}
              onSendFile={sendFile}
              onSendDossier={sendDossier}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function ConversationRow({
  conv,
  active,
  online,
  onPick,
  youLabel,
}: {
  conv: ConversationSummary;
  active: boolean;
  online: boolean;
  onPick: () => void;
  youLabel: string;
}) {
  const last = conv.lastMessage;
  const preview =
    !last
      ? ""
      : last.kind === "text"
        ? last.body ?? ""
        : last.kind === "file"
          ? `📎 ${last.file?.name ?? ""}`
          : `📁 ${last.dossier?.snapshot.fullName ?? "DOSSIER"}`;
  const timeStr = last ? formatDate(last.createdAt) : "";

  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "w-full text-left rounded-md px-3 py-2.5 mb-1 flex items-start gap-3 transition border",
        active
          ? "bg-emerald-glow/[0.07] border-emerald-glow/30 shadow-glow-emerald"
          : "border-transparent hover:bg-white/[0.04]",
      )}
    >
      <div className="relative shrink-0">
        <Avatar uid={conv.peer.uid} name={conv.peer.displayName} url={conv.peer.avatarUrl} />
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-50",
            online ? "bg-emerald-glow" : "bg-white/20",
          )}
          aria-label={online ? "online" : "offline"}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[13px] text-white truncate">
            {conv.peer.displayName ?? `Operative ${conv.peer.uid}`}
          </span>
          <span className="font-mono text-[10px] text-white/35 ml-auto shrink-0">
            {timeStr}
          </span>
        </div>
        <div className="font-mono text-[11px] text-white/45 truncate">
          {last && last.senderId === conv.peer.id
            ? preview
            : `${youLabel}: ${preview}`}
        </div>
      </div>
      {conv.unread > 0 && (
        <span className="ml-1 mt-0.5 inline-flex h-5 min-w-[20px] px-1.5 rounded-full bg-emerald-glow/20 border border-emerald-glow/50 text-emerald-glow text-[10px] font-mono items-center justify-center">
          {conv.unread}
        </span>
      )}
    </button>
  );
}

function ThreadEmpty({ label }: { label: string }) {
  return (
    <div className="flex-1 grid place-items-center text-center px-6 py-10">
      <div>
        <div className="mx-auto h-14 w-14 rounded-full bg-emerald-glow/10 border border-emerald-glow/30 grid place-items-center mb-3">
          <MessageSquare size={26} className="text-emerald-glow" />
        </div>
        <div className="text-white/55 text-sm">{label}</div>
      </div>
    </div>
  );
}

function Thread({
  user,
  peer,
  messages,
  threadLoading,
  dossiers,
  peerOnline,
  onClose,
  onSendText,
  onSendFile,
  onSendDossier,
}: {
  user: SessionUserDto;
  peer: ActivePeer;
  messages: ChatMessage[];
  threadLoading: boolean;
  dossiers: Dossier[];
  peerOnline: boolean;
  onClose: () => void;
  onSendText: (s: string) => void;
  onSendFile: (f: File) => void;
  onSendDossier: (id: string) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const [showDossierPicker, setShowDossierPicker] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Autoscroll on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  function send() {
    if (!draft.trim()) return;
    onSendText(draft);
    setDraft("");
  }

  return (
    <>
      {/* header */}
      <header className="flex items-center gap-3 px-3 sm:px-4 py-2.5 border-b border-white/[0.06]">
        <button
          type="button"
          onClick={onClose}
          className="lg:hidden btn-ghost h-8 w-8 p-0 grid place-items-center"
          aria-label={t.chat.backToList}
        >
          <ArrowLeft size={14} />
        </button>
        <Avatar uid={peer.uid} name={peer.displayName} url={peer.avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-white truncate">
            {peer.displayName ?? `Operative ${peer.uid}`}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40 flex items-center gap-2">
            <span>UID {peer.uid}</span>
            <span
              className={cn(
                "h-1 w-1 rounded-full",
                peerOnline
                  ? "bg-emerald-glow animate-pulseDot"
                  : "bg-white/30",
              )}
            />
            <span className={peerOnline ? "text-emerald-glow" : "text-white/35"}>
              {peerOnline ? t.chat.online : "OFFLINE"}
            </span>
          </div>
        </div>
        <div className="badge-ok hidden sm:inline-flex">
          <ShieldCheck size={10} /> {t.chat.encrypted}
        </div>
      </header>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-3">
        {threadLoading && messages.length === 0 && (
          <div className="text-white/40 text-xs font-mono uppercase tracking-[0.18em] flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" />
            {t.chat.listLoading}
          </div>
        )}
        {!threadLoading && messages.length === 0 && (
          <div className="text-white/40 text-xs">{t.chat.threadEmpty}</div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} message={m} mine={m.senderId === user.id} />
        ))}
      </div>

      {/* composer */}
      <footer className="px-2 sm:px-3 py-2 border-t border-white/[0.06]">
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn-ghost h-10 w-10 p-0 grid place-items-center shrink-0"
            aria-label={t.chat.attach}
            title={t.chat.attach}
          >
            <Paperclip size={15} />
          </button>
          <button
            type="button"
            onClick={() => setShowDossierPicker(true)}
            className="btn-ghost h-10 w-10 p-0 grid place-items-center shrink-0"
            aria-label={t.chat.shareDossier}
            title={t.chat.shareDossier}
          >
            <Folder size={15} />
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onSendFile(f);
              if (e.currentTarget) e.currentTarget.value = "";
            }}
          />
          <textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={t.chat.typePlaceholder}
            className="field flex-1 resize-none min-h-[40px] max-h-[140px]"
          />
          <button
            type="button"
            onClick={send}
            disabled={!draft.trim()}
            className="btn-primary h-10 px-3 sm:px-4 shrink-0"
          >
            <Send size={14} />
            <span className="hidden sm:inline">{t.chat.send}</span>
          </button>
        </div>
      </footer>

      <AnimatePresence>
        {showDossierPicker && (
          <DossierPicker
            dossiers={dossiers}
            onClose={() => setShowDossierPicker(false)}
            onPick={(id) => {
              setShowDossierPicker(false);
              onSendDossier(id);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function Bubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-snug",
          mine
            ? "bg-emerald-glow/[0.12] border border-emerald-glow/40 text-white"
            : "bg-white/[0.05] border border-white/10 text-white/90",
        )}
      >
        {message.kind === "text" && (
          <div className="whitespace-pre-wrap break-words">{message.body}</div>
        )}
        {message.kind === "file" && message.file && (
          <FilePreview file={message.file} />
        )}
        {message.kind === "dossier" && message.dossier && (
          <DossierBubble snap={message.dossier.snapshot} />
        )}
        <div className="mt-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-white/35">
          <Lock size={9} />
          {formatDate(message.createdAt, true)}
        </div>
      </div>
    </div>
  );
}

function FilePreview({
  file,
}: {
  file: NonNullable<ChatMessage["file"]>;
}) {
  const isImage = file.mime.startsWith("image/");
  const dataUrl = `data:${file.mime};base64,${file.dataBase64}`;
  return (
    <div className="space-y-2">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt={file.name}
          className="max-h-72 w-auto rounded-lg border border-white/10"
        />
      ) : (
        <div className="flex items-center gap-3 surface px-3 py-2">
          <div className="h-9 w-9 rounded bg-emerald-glow/15 border border-emerald-glow/40 grid place-items-center text-emerald-glow">
            <FileText size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-white truncate">{file.name}</div>
            <div className="font-mono text-[10px] text-white/40">
              {(file.size / 1024).toFixed(1)} KB · {file.mime || "binary"}
            </div>
          </div>
        </div>
      )}
      <a
        href={dataUrl}
        download={file.name}
        className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.22em] text-emerald-glow hover:text-white"
      >
        <Download size={11} /> {file.name}
      </a>
    </div>
  );
}

function DossierBubble({ snap }: { snap: DossierSnapshot }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2 max-w-[280px]">
      <div className="badge bg-warning/[0.06] border-warning/30 text-warning">
        <ShieldAlert size={10} /> {snap.classification}
      </div>
      <div className="text-[14px] font-semibold text-white truncate">
        {snap.fullName ?? "UNTITLED SUBJECT"}
      </div>
      {snap.alias && (
        <div className="font-mono text-[11px] text-white/55">
          ALIAS · {snap.alias}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <KV label={t.chat.dossierClassification} value={snap.classification} />
        <KV label={t.chat.dossierRisk} value={snap.riskLevel} accent />
        <KV label="STATUS" value={snap.status} />
        <KV
          label="LOCATION"
          value={[snap.city, snap.country].filter(Boolean).join(", ") || "—"}
        />
      </div>
      {snap.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {snap.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded font-mono text-[10px] uppercase bg-emerald-glow/[0.07] border border-emerald-glow/30 text-emerald-glow"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/35 pt-1">
        REF · AGS-{snap.ref.slice(-8).toUpperCase()}
      </div>
    </div>
  );
}

function KV({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | null | undefined;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/35">
        {label}
      </div>
      <div
        className={cn(
          "truncate text-[11.5px]",
          accent ? "text-amber-glow" : "text-white/80",
        )}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}

function PeerSearch({
  currentId,
  onPick,
}: {
  currentId: string;
  onPick: (peer: UserSearchResult) => void;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results.filter((r: UserSearchResult) => r.id !== currentId));
        }
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, currentId]);

  return (
    <div className="px-2 py-2 relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
          {loading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Search size={13} />
          )}
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.chat.findOperativePlaceholder}
          className="field pl-9 h-9 text-[12.5px]"
        />
      </div>
      <AnimatePresence>
        {results.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute left-2 right-2 top-full mt-1 surface-strong p-1 z-30 max-h-72 overflow-y-auto"
          >
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(r);
                    setQ("");
                    setResults([]);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-white/[0.05] text-left"
                >
                  <Avatar uid={r.uid} name={r.displayName} url={r.avatarUrl} />
                  <div className="min-w-0">
                    <div className="text-[13px] text-white truncate">
                      {r.displayName ?? `Operative ${r.uid}`}
                    </div>
                    <div className="font-mono text-[10px] text-white/40">UID {r.uid}</div>
                  </div>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function Avatar({
  uid,
  name,
  url,
}: {
  uid: string;
  name: string | null;
  url: string | null;
}) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={name ?? uid}
        className="h-9 w-9 rounded-md object-cover border border-white/10"
      />
    );
  }
  const seed = name ?? uid;
  const letter =
    seed.replace(/[^A-Za-z0-9]/g, "").charAt(0)?.toUpperCase() || "A";
  return (
    <div className="h-9 w-9 rounded-md grid place-items-center bg-emerald-glow/15 border border-emerald-glow/40 text-emerald-glow font-mono text-[13px]">
      {letter}
    </div>
  );
}

function DossierPicker({
  dossiers,
  onPick,
  onClose,
}: {
  dossiers: Dossier[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return dossiers;
    return dossiers.filter((d) =>
      [d.fullName, d.alias, d.city, d.country, ...(d.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(s),
    );
  }, [dossiers, q]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-md p-3 sm:p-6"
    >
      <motion.div
        initial={{ y: 18, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 8, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="surface-strong rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col"
      >
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-3">
          <Folder className="text-emerald-glow" size={16} />
          <h3 className="heading-display text-sm text-white flex-1">
            {t.chat.pickDossier}
          </h3>
          <button
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded text-white/55 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-white/[0.06]">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.database.searchPlaceholder}
              className="field pl-9 h-9 text-[12.5px]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-white/45 text-sm">
              {t.chat.noDossiers}
            </div>
          ) : (
            <ul>
              {filtered.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => onPick(d.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-white/[0.05] text-left"
                  >
                    <div className="h-9 w-9 rounded-md bg-emerald-glow/15 border border-emerald-glow/40 grid place-items-center text-emerald-glow">
                      <Folder size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] text-white truncate">
                        {d.fullName ?? "UNTITLED SUBJECT"}
                      </div>
                      <div className="font-mono text-[10px] text-white/40 truncate">
                        AGS-{d.id.slice(-8).toUpperCase()} ·{" "}
                        {d.classification}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
