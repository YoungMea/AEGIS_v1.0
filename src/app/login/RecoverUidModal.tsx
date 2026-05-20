"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Phone,
  Send,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Copy,
  Fingerprint,
  RefreshCw,
} from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";

type Stage = "phone" | "verify" | "revealed";

interface Props {
  onClose: () => void;
  onPickUid?: (uid: string) => void;
}

/**
 * Self-contained modal for the "Forgot UID" flow.
 *
 *   1. User enters phone → POST /api/auth/recover-uid/start
 *   2. Server pushes OTP to the user's bound Telegram chat (silently no-ops
 *      if the phone isn't registered, so we never leak existence).
 *   3. User enters the 6-digit code → POST /api/auth/recover-uid/reveal
 *   4. UID is shown; user can copy it or hand it back to the parent form.
 */
export function RecoverUidModal({ onClose, onPickUid }: Props) {
  const { t } = useI18n();
  const [stage, setStage] = useState<Stage>("phone");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [channelHint, setChannelHint] = useState<"telegram" | "none">("telegram");

  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [uid, setUid] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function startRecover(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!/^\+?[0-9\s\-()]{6,20}$/.test(phone)) {
      setError(t.auth.register.phoneInvalid);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/recover-uid/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t.auth.recoverUid.genericError);
        return;
      }
      setSessionId(data.sessionId);
      setExpiresAt(data.expiresAt);
      setChannelHint(data.channelHint ?? "telegram");
      setCode(Array(6).fill(""));
      setStage("verify");
    } catch {
      setError(t.common.networkError);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!sessionId) return;
    const codeStr = code.join("");
    if (codeStr.length !== 6) {
      setError(t.auth.register.verifyFull);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/recover-uid/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, code: codeStr }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t.auth.login.authFailed);
        return;
      }
      setUid(data.uid);
      setStage("revealed");
    } catch {
      setError(t.common.networkError);
    } finally {
      setBusy(false);
    }
  }

  async function copyUid() {
    if (!uid) return;
    try {
      await navigator.clipboard.writeText(uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] grid place-items-center bg-black/75 backdrop-blur-md p-3 sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ duration: 0.22 }}
        className="surface-strong relative w-full max-w-md rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-emerald-glow/30 via-transparent to-emerald-glow/10 blur-xl opacity-50 pointer-events-none" />

        <div className="relative">
          {/* Header */}
          <div className="px-5 sm:px-6 pt-5 pb-3 flex items-center gap-3 border-b border-white/[0.06]">
            <Fingerprint className="text-emerald-glow" size={18} />
            <div className="min-w-0 flex-1">
              <h3 className="heading-display text-base text-white truncate">
                {t.auth.recoverUid.title}
              </h3>
            </div>
            <button
              onClick={onClose}
              aria-label={t.common.close}
              className="h-8 w-8 grid place-items-center rounded text-white/55 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 min-h-[260px]">
            <AnimatePresence mode="wait">
              {stage === "phone" && (
                <Pane key="phone">
                  <p className="text-white/55 text-xs leading-relaxed">
                    {t.auth.recoverUid.sub}
                  </p>
                  <form onSubmit={startRecover} className="mt-5 space-y-4">
                    <Field
                      label={t.auth.recoverUid.phoneLabel}
                      icon={<Phone size={14} />}
                    >
                      <input
                        type="tel"
                        autoComplete="tel"
                        autoFocus
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder={t.auth.recoverUid.phonePlaceholder}
                        className="field"
                      />
                    </Field>

                    <ErrorLine error={error} />

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={onClose}
                        className="btn-ghost h-10 text-xs uppercase tracking-[0.18em] font-mono"
                      >
                        <ArrowLeft size={14} /> {t.auth.recoverUid.backToLogin}
                      </button>
                      <button
                        type="submit"
                        disabled={busy}
                        className="btn-primary h-10 px-4"
                      >
                        {busy ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <>
                            {t.auth.recoverUid.sendCode} <Send size={14} />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </Pane>
              )}

              {stage === "verify" && (
                <Pane key="verify">
                  <p className="text-white/55 text-xs leading-relaxed">
                    {t.auth.recoverUid.verifySub}
                  </p>
                  {channelHint === "none" && (
                    <div className="mt-3 surface border-amber-glow/30 bg-amber-glow/[0.06] p-3 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-glow leading-relaxed">
                      {t.auth.recoverUid.noChannelHint}
                    </div>
                  )}

                  <form onSubmit={verify} className="mt-5 space-y-5">
                    <OtpInput
                      value={code}
                      onChange={setCode}
                      onComplete={() => verify()}
                    />
                    <ErrorLine error={error} />

                    {expiresAt && <Countdown to={expiresAt} label={t.auth.register.codeExpiresIn} />}

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setStage("phone");
                          setError(null);
                          setCode(Array(6).fill(""));
                        }}
                        className="btn-ghost h-10 text-xs uppercase tracking-[0.18em] font-mono"
                      >
                        <ArrowLeft size={14} /> {t.auth.recoverUid.tryAgain}
                      </button>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startRecover()}
                          disabled={busy}
                          className="btn-ghost h-10 text-xs uppercase tracking-[0.18em] font-mono"
                        >
                          <RefreshCw size={14} /> {t.auth.register.resend}
                        </button>
                        <button
                          type="submit"
                          disabled={busy}
                          className="btn-primary h-10 px-4"
                        >
                          {busy ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <>
                              {t.auth.recoverUid.verify}{" "}
                              <ShieldCheck size={14} />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </Pane>
              )}

              {stage === "revealed" && uid && (
                <Pane key="revealed">
                  <div className="text-center">
                    <motion.div
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 18 }}
                      className="mx-auto h-14 w-14 rounded-full border-2 border-emerald-glow/60 grid place-items-center shadow-glow-emerald-strong mb-4"
                    >
                      <CheckCircle2 size={28} className="text-emerald-glow" />
                    </motion.div>
                    <h3 className="heading-display text-base text-white">
                      {t.auth.recoverUid.revealedTitle}
                    </h3>
                    <p className="text-white/55 text-xs mt-1.5 max-w-xs mx-auto">
                      {t.auth.recoverUid.revealedSub}
                    </p>

                    <div className="mt-5 mx-auto inline-flex items-center gap-3 surface-strong px-5 py-4">
                      <div className="font-display text-2xl tracking-[0.32em] text-emerald-glow text-glow">
                        {uid}
                      </div>
                      <button
                        type="button"
                        onClick={copyUid}
                        className="btn-ghost h-9 px-2 text-[10px] uppercase tracking-[0.18em] font-mono"
                      >
                        {copied ? (
                          <>
                            <CheckCircle2 size={12} /> {t.common.copied}
                          </>
                        ) : (
                          <>
                            <Copy size={12} /> {t.auth.recoverUid.copy}
                          </>
                        )}
                      </button>
                    </div>

                    <div className="mt-6 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (onPickUid && uid) onPickUid(uid);
                          onClose();
                        }}
                        className="btn-primary h-10 px-5"
                      >
                        {t.auth.recoverUid.done}
                      </button>
                    </div>
                  </div>
                </Pane>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.05] px-5 sm:px-6 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white/35 text-center">
            UID RECOVERY · TLS-1.3 · 0xE5
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Pane({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="label-mono mb-1.5 flex items-center gap-1.5">
        <span className="text-emerald-glow">{icon}</span>
        {label}
      </div>
      {children}
    </label>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="text-warning text-xs font-mono uppercase tracking-wider"
        >
          ▸ {error}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function OtpInput({
  value,
  onChange,
  onComplete,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  onComplete?: () => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function setAt(i: number, v: string) {
    const digit = v.replace(/\D/g, "").slice(-1);
    const next = [...value];
    next[i] = digit;
    onChange(next);
    if (digit && i < 5) refs.current[i + 1]?.focus();
    if (next.every((d) => d !== "") && onComplete) onComplete();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const txt = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!txt) return;
    e.preventDefault();
    const next = txt.split("").concat(Array(6).fill("")).slice(0, 6);
    onChange(next);
    refs.current[Math.min(txt.length, 5)]?.focus();
    if (txt.length === 6 && onComplete) onComplete();
  }

  return (
    <div className="grid grid-cols-6 gap-2 sm:gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => setAt(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          className="field h-12 sm:h-14 text-center font-mono text-xl tracking-widest"
        />
      ))}
    </div>
  );
}

function Countdown({ to, label }: { to: number; label: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.floor((to - now) / 1000));
  const m = Math.floor(left / 60).toString().padStart(2, "0");
  const s = (left % 60).toString().padStart(2, "0");
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
      {label} {m}:{s}
    </div>
  );
}
