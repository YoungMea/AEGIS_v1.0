"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Phone,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Copy,
  Send,
  ExternalLink,
} from "lucide-react";
import { CinematicBackground } from "@/components/ui/CinematicBackground";
import { Logo } from "@/components/ui/Logo";
import { StatusBar } from "@/components/ui/StatusBar";
import { PasswordStrength, evaluatePassword } from "@/components/ui/PasswordStrength";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useI18n } from "@/components/i18n/I18nProvider";

type Step = 0 | 1 | 2 | 3 | 4;

const BOT_USERNAME =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "Aegis_verification_bot";

type StartResponse =
  | {
      mode: "telegram";
      linkToken: string;
      botUsername: string;
      deepLink: string;
      expiresAt: number;
    }
  | {
      mode: "simulate" | "sms";
      sessionId: string;
      expiresAt: number;
      devCode?: string;
    };

export function RegisterClient() {
  const router = useRouter();
  const { t } = useI18n();
  const [step, setStep] = useState<Step>(0);

  const [phone, setPhone] = useState("");

  // Telegram link state (step 1)
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string>("");
  const [botUsername, setBotUsername] = useState<string>(BOT_USERNAME);
  const [linkExpiresAt, setLinkExpiresAt] = useState<number | null>(null);
  const [linked, setLinked] = useState(false);
  const [tgUsername, setTgUsername] = useState<string | null>(null);

  // Generic OTP session state (step 2)
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [issuedUid, setIssuedUid] = useState<string | null>(null);

  // Step 0 — request OTP / Telegram link
  async function startPhone(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\+?[0-9\s\-()]{6,20}$/.test(phone)) {
      setError(t.auth.register.phoneInvalid);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data: StartResponse | { error: string } = await res.json();
      if (!res.ok) {
        setError(("error" in data ? data.error : null) ?? t.common.networkError);
        setBusy(false);
        return;
      }

      if ("mode" in data && data.mode === "telegram") {
        setLinkToken(data.linkToken);
        setDeepLink(data.deepLink);
        setBotUsername(data.botUsername);
        setLinkExpiresAt(data.expiresAt);
        setLinked(false);
        setTgUsername(null);
        setStep(1);
      } else if ("mode" in data) {
        // simulate / sms — skip the Telegram step entirely
        setSessionId(data.sessionId);
        setOtpExpiresAt(data.expiresAt);
        setDevCode("devCode" in data ? (data.devCode ?? null) : null);
        setStep(2);
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  // Step 1 — poll for the chat link, then trigger OTP send.
  useEffect(() => {
    if (step !== 1 || !linkToken || linked) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch(
          `/api/auth/register/telegram-status?token=${encodeURIComponent(linkToken!)}`,
        );
        if (!res.ok) {
          if (res.status === 410) {
            setError("Verification link expired. Please restart.");
            return;
          }
        } else {
          const data = await res.json();
          if (data.linked) {
            if (!cancelled) {
              setLinked(true);
              setTgUsername(data.username ?? null);
            }
            return;
          }
        }
      } catch {
        /* ignore — keep polling */
      }
      if (!cancelled) timer = setTimeout(poll, 2000);
    }
    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [step, linkToken, linked]);

  // Once linked, push a code into Telegram.
  async function sendTelegramCode() {
    if (!linkToken) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register/telegram-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not deliver code");
        return;
      }
      setSessionId(data.sessionId);
      setOtpExpiresAt(data.expiresAt);
      setDevCode(null);
      setCode(Array(6).fill(""));
      setStep(2);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  // Step 2 — verify OTP
  async function verifyCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    const codeStr = code.join("");
    if (codeStr.length !== 6) {
      setError("Enter the full 6-digit code");
      return;
    }
    if (!sessionId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, code: codeStr }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid code");
        setBusy(false);
        return;
      }
      setStep(3);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError(null);
    setCode(Array(6).fill(""));
    try {
      // Telegram channel: re-send through linkToken
      if (linkToken && linked) {
        const res = await fetch("/api/auth/register/telegram-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ linkToken }),
        });
        const data = await res.json();
        if (!res.ok) setError(data.error ?? "Could not resend code");
        else {
          setSessionId(data.sessionId);
          setOtpExpiresAt(data.expiresAt);
        }
        return;
      }
      // Legacy SMS / simulate channels
      const res = await fetch("/api/auth/register/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not resend code");
      } else if (data.mode === "telegram") {
        // The server is configured for telegram now — redirect to step 1.
        setLinkToken(data.linkToken);
        setDeepLink(data.deepLink);
        setBotUsername(data.botUsername);
        setLinkExpiresAt(data.expiresAt);
        setLinked(false);
        setStep(1);
      } else {
        setSessionId(data.sessionId);
        setDevCode(data.devCode ?? null);
        setOtpExpiresAt(data.expiresAt);
      }
    } finally {
      setBusy(false);
    }
  }

  // Step 3 — finalize
  async function finalize(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const r = evaluatePassword(password);
    if (r.score < 3) {
      setError(t.auth.register.strengthError);
      return;
    }
    if (!sessionId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          password,
          displayName: displayName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t.common.networkError);
        setBusy(false);
        return;
      }
      setIssuedUid(data.user.uid);
      setStep(4);
      setTimeout(() => router.push("/dashboard"), 4500);
    } catch {
      setError(t.common.networkError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen flex flex-col">
      <CinematicBackground variant="auth" />

      <header className="px-5 sm:px-8 py-5 flex items-center justify-between gap-3">
        <Link href="/login" className="flex items-center gap-3 group">
          <Logo size={32} />
          <div>
            <div className="font-display tracking-[0.3em] text-emerald-glow text-glow text-sm">
              AEGIS
            </div>
            <div className="label-mono">{t.auth.enrollmentProtocol}</div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <div className="hidden md:block">
            <StatusBar />
          </div>
        </div>
      </header>

      <section className="flex-1 grid place-items-center px-5 sm:px-8 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative w-full max-w-xl"
        >
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-emerald-glow/30 via-transparent to-emerald-glow/10 opacity-60 blur-xl" />
          <div className="relative surface-strong rounded-2xl overflow-hidden">
            <Stepper step={step} t={t} />

            <div className="p-6 sm:p-8 min-h-[420px]">
              <AnimatePresence mode="wait">
                {step === 0 && (
                  <Pane key="0">
                    <Header
                      title={t.auth.register.phoneTitle}
                      sub={t.auth.register.phoneSub}
                    />
                    <form onSubmit={startPhone} className="space-y-5 mt-6">
                      <Field
                        label={t.auth.register.phoneLabel}
                        icon={<Phone size={14} />}
                        hint={t.auth.register.phoneHint}
                      >
                        <input
                          type="tel"
                          autoComplete="tel"
                          placeholder={t.auth.register.phonePlaceholder}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="field"
                        />
                      </Field>

                      <ErrorLine error={error} />

                      <div className="flex items-center justify-between gap-3">
                        <Link
                          href="/login"
                          className="btn-ghost h-10 text-xs uppercase tracking-[0.18em] font-mono"
                        >
                          <ArrowLeft size={14} /> {t.common.back}
                        </Link>
                        <button
                          type="submit"
                          disabled={busy}
                          className="btn-primary h-10 px-5"
                        >
                          {busy ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <>
                              {t.common.continue} <ArrowRight size={16} />
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </Pane>
                )}

                {step === 1 && (
                  <Pane key="1">
                    <Header
                      title={t.auth.register.tgTitle}
                      sub={t.auth.register.tgSub}
                    />

                    <TelegramLinkPanel
                      botUsername={botUsername}
                      deepLink={deepLink}
                      linked={linked}
                      tgUsername={tgUsername}
                      t={t}
                    />

                    <ErrorLine error={error} />

                    <div className="mt-6 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setStep(0)}
                        className="btn-ghost h-10 text-xs uppercase tracking-[0.18em] font-mono"
                      >
                        <ArrowLeft size={14} /> {t.common.back}
                      </button>
                      <button
                        type="button"
                        onClick={sendTelegramCode}
                        disabled={!linked || busy}
                        className="btn-primary h-10 px-5"
                      >
                        {busy ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <>
                            {t.auth.register.tgSendCode} <Send size={14} />
                          </>
                        )}
                      </button>
                    </div>

                    {linkExpiresAt && !linked && (
                      <div className="mt-4">
                        <Countdown
                          to={linkExpiresAt}
                          label={t.auth.register.linkExpiresIn}
                        />
                      </div>
                    )}
                  </Pane>
                )}

                {step === 2 && (
                  <Pane key="2">
                    <Header
                      title={t.auth.register.verifyTitle}
                      sub={
                        linkToken
                          ? tgUsername
                            ? `${t.auth.register.verifySubTelegramTo} (@${tgUsername}).`
                            : t.auth.register.verifySubTelegram
                          : `${t.auth.register.verifySubSms} ${phone}.`
                      }
                    />

                    {devCode && <DevCodeBanner code={devCode} t={t} />}

                    <form onSubmit={verifyCode} className="mt-6 space-y-5">
                      <OtpInput
                        value={code}
                        onChange={setCode}
                        onComplete={() => verifyCode()}
                      />

                      <ErrorLine error={error} />

                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setStep(linkToken ? 1 : 0)}
                          className="btn-ghost h-10 text-xs uppercase tracking-[0.18em] font-mono"
                        >
                          <ArrowLeft size={14} /> {t.common.back}
                        </button>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={resend}
                            disabled={busy}
                            className="btn-ghost h-10 text-xs uppercase tracking-[0.18em] font-mono"
                          >
                            <RefreshCw size={14} /> {t.auth.register.resend}
                          </button>
                          <button
                            type="submit"
                            disabled={busy}
                            className="btn-primary h-10 px-5"
                          >
                            {busy ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <>
                                {t.auth.register.verifyButton} <ShieldCheck size={16} />
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {otpExpiresAt && (
                        <Countdown
                          to={otpExpiresAt}
                          label={t.auth.register.codeExpiresIn}
                        />
                      )}
                    </form>
                  </Pane>
                )}

                {step === 3 && (
                  <Pane key="3">
                    <Header
                      title={t.auth.register.keyTitle}
                      sub={t.auth.register.keySub}
                    />
                    <form onSubmit={finalize} className="mt-6 space-y-4">
                      <Field
                        label={t.auth.register.displayNameLabel}
                        icon={<ShieldCheck size={14} />}
                        hint={t.auth.register.displayNameHint}
                      >
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder={t.auth.register.displayNamePlaceholder}
                          className="field"
                          maxLength={80}
                        />
                      </Field>

                      <Field
                        label={t.auth.register.passwordLabel}
                        icon={<KeyRound size={14} />}
                      >
                        <input
                          type="password"
                          autoComplete="new-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={t.auth.register.passwordPlaceholder}
                          className="field"
                        />
                        <PasswordStrength value={password} />
                      </Field>

                      <ErrorLine error={error} />

                      <div className="flex items-center justify-between gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          className="btn-ghost h-10 text-xs uppercase tracking-[0.18em] font-mono"
                        >
                          <ArrowLeft size={14} /> {t.common.back}
                        </button>
                        <button
                          type="submit"
                          disabled={busy}
                          className="btn-primary h-10 px-5"
                        >
                          {busy ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <>
                              {t.auth.register.issueClearance} <ArrowRight size={16} />
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </Pane>
                )}

                {step === 4 && issuedUid && (
                  <Pane key="4">
                    <SuccessPanel uid={issuedUid} t={t} />
                  </Pane>
                )}
              </AnimatePresence>
            </div>

            <div className="border-t border-white/[0.05] px-6 sm:px-8 py-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
              <span>ENROLLMENT · TLS-1.3 · 0xE5</span>
              <span>EDUCATIONAL DEPLOYMENT</span>
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}

function Stepper({ step, t }: { step: Step; t: import("@/lib/i18n").Translation }) {
  const steps = [
    { title: t.auth.register.steps.phone, sub: t.auth.register.steps.phoneSub },
    { title: t.auth.register.steps.telegram, sub: t.auth.register.steps.telegramSub },
    { title: t.auth.register.steps.verify, sub: t.auth.register.steps.verifySub },
    { title: t.auth.register.steps.key, sub: t.auth.register.steps.keySub },
    { title: t.auth.register.steps.issued, sub: t.auth.register.steps.issuedSub },
  ];
  return (
    <div className="px-4 sm:px-6 pt-6 pb-3 flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
      {steps.map((s, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <div key={i} className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className={`h-7 w-7 shrink-0 rounded-md border flex items-center justify-center font-mono text-[11px] ${
                done
                  ? "bg-emerald-glow/20 border-emerald-glow/60 text-emerald-glow"
                  : active
                    ? "border-emerald-glow/60 text-emerald-glow shadow-glow-emerald"
                    : "border-white/10 text-white/30"
              }`}
            >
              {done ? <CheckCircle2 size={14} /> : `0${i + 1}`}
            </div>
            <div className="hidden sm:block min-w-0">
              <div
                className={`label-mono ${active ? "text-emerald-glow" : ""}`}
              >
                {s.title}
              </div>
              <div className="font-mono text-[10px] text-white/30 truncate">
                {s.sub}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 h-px bg-white/10 mx-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Pane({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
    >
      {children}
    </motion.div>
  );
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <>
      <h2 className="heading-display text-xl text-white">{title}</h2>
      <p className="text-white/50 text-xs mt-1.5 leading-relaxed max-w-md">
        {sub}
      </p>
    </>
  );
}

function Field({
  label,
  icon,
  hint,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="label-mono flex items-center gap-1.5">
          <span className="text-emerald-glow">{icon}</span>
          {label}
        </span>
        {hint && (
          <span className="font-mono text-[10px] text-white/30">{hint}</span>
        )}
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
          className="field h-14 sm:h-16 text-center font-mono text-2xl tracking-widest"
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

function DevCodeBanner({ code, t }: { code: string; t: import("@/lib/i18n").Translation }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* ignore */
    }
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-5 surface flex items-center gap-3 p-3 border-emerald-glow/30"
    >
      <div className="badge-ok">{t.auth.register.simulatedOtp}</div>
      <div className="font-mono text-base tracking-[0.4em] text-emerald-glow text-glow ml-1">
        {code}
      </div>
      <button
        onClick={copy}
        type="button"
        className="ml-auto btn-ghost h-8 px-2 text-[10px] uppercase tracking-[0.18em] font-mono"
      >
        <Copy size={12} /> {t.common.copy}
      </button>
    </motion.div>
  );
}

function TelegramLogo({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="tg-grad" x1="120" y1="0" x2="120" y2="240">
          <stop offset="0%" stopColor="#37BBFE" />
          <stop offset="100%" stopColor="#007DBB" />
        </linearGradient>
      </defs>
      <circle cx="120" cy="120" r="120" fill="url(#tg-grad)" />
      <path
        d="M51 117l130-50c6-2 11 1 9 9l-22 105c-1 6-5 8-11 5l-31-23-15 14c-2 2-3 3-7 3l3-32 88-79c4-3-1-5-6-2l-108 68-31-10c-7-2-7-7 1-10z"
        fill="white"
      />
    </svg>
  );
}

function TelegramLinkPanel({
  botUsername,
  deepLink,
  linked,
  tgUsername,
  t,
}: {
  botUsername: string;
  deepLink: string;
  linked: boolean;
  tgUsername: string | null;
  t: import("@/lib/i18n").Translation;
}) {
  return (
    <div className="mt-6 space-y-4">
      {/* Bot identity card */}
      <div className="surface flex items-center gap-3 p-3.5">
        <TelegramLogo size={32} />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/40">
            {t.auth.register.tgBotLabel}
          </div>
          <div className="text-white text-sm truncate">@{botUsername}</div>
        </div>
        <div className={linked ? "badge-ok" : "badge"}>
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              linked ? "bg-emerald-glow animate-pulseDot" : "bg-white/40"
            }`}
          />
          {linked ? t.auth.register.tgLinked : t.auth.register.tgAwaiting}
        </div>
      </div>

      {/* Step instructions */}
      <ol className="space-y-2">
        <Instruction
          step={1}
          done={true}
          title={t.auth.register.tgInstruction1Title}
          desc={t.auth.register.tgInstruction1Desc}
        />
        <Instruction
          step={2}
          done={linked}
          title={t.auth.register.tgInstruction2Title}
          desc={t.auth.register.tgInstruction2Desc}
        />
        <Instruction
          step={3}
          done={false}
          title={t.auth.register.tgInstruction3Title}
          desc={t.auth.register.tgInstruction3Desc}
        />
      </ol>

      {/* Open bot button */}
      <a
        href={deepLink}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block group"
      >
        <div className="absolute -inset-px rounded-lg bg-gradient-to-r from-[#37BBFE]/40 via-[#1E96D9]/30 to-[#37BBFE]/40 blur-md opacity-60 group-hover:opacity-100 transition" />
        <div className="relative flex items-center gap-3 rounded-lg border border-[#37BBFE]/40 bg-[#0E1A26]/80 px-4 py-3.5 hover:bg-[#0E2435]/80 transition">
          <TelegramLogo size={22} />
          <div className="min-w-0 flex-1 text-left">
            <div className="text-sm text-white">
              {t.auth.register.tgOpenButton}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40 truncate">
              t.me/{botUsername}
            </div>
          </div>
          <ExternalLink size={16} className="text-white/60" />
        </div>
      </a>

      {linked && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-emerald-glow text-xs font-mono uppercase tracking-wider"
        >
          <CheckCircle2 size={14} />
          {tgUsername
            ? `${t.auth.register.tgChannelLinkedTo} @${tgUsername}.`
            : `${t.auth.register.tgChannelLinked}.`}
        </motion.div>
      )}
    </div>
  );
}

function Instruction({
  step,
  done,
  title,
  desc,
}: {
  step: number;
  done: boolean;
  title: string;
  desc: string;
}) {
  return (
    <li className="flex gap-3 items-start">
      <div
        className={`mt-0.5 h-6 w-6 shrink-0 rounded-md border grid place-items-center font-mono text-[11px] ${
          done
            ? "bg-emerald-glow/15 border-emerald-glow/40 text-emerald-glow"
            : "border-white/15 text-white/40"
        }`}
      >
        {done ? <CheckCircle2 size={12} /> : step}
      </div>
      <div>
        <div
          className={`text-[13px] ${done ? "text-white/85" : "text-white/65"}`}
        >
          {title}
        </div>
        <div className="text-[12px] text-white/40">{desc}</div>
      </div>
    </li>
  );
}

function SuccessPanel({ uid, t }: { uid: string; t: import("@/lib/i18n").Translation }) {
  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className="mx-auto h-20 w-20 rounded-full border-2 border-emerald-glow/60 grid place-items-center shadow-glow-emerald-strong mb-6"
      >
        <CheckCircle2 size={42} className="text-emerald-glow" />
      </motion.div>
      <h2 className="heading-display text-2xl text-white">
        {t.auth.register.successTitle}
      </h2>
      <p className="text-white/50 text-xs mt-2">
        {t.auth.register.successSub}
      </p>

      <div className="mx-auto mt-7 w-full max-w-xs surface-strong p-5 text-left">
        <div className="label-mono">{t.auth.register.assignedUid}</div>
        <div className="mt-2 font-display text-3xl tracking-[0.32em] text-emerald-glow text-glow">
          {uid}
        </div>
        <div className="mt-3 h-px bg-white/10" />
        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-white/40">
          <span>{t.add.statusLabel}</span>
          <span className="text-right text-emerald-glow">
            {t.auth.register.statusActive}
          </span>
          <span>{t.auth.register.tier}</span>
          <span className="text-right text-white/70">L5</span>
        </div>
      </div>

      <div className="mt-7 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
        <Loader2 className="animate-spin" size={12} />
        {t.auth.register.routing}
      </div>
    </div>
  );
}
