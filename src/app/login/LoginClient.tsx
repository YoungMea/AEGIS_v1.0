"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fingerprint,
  KeyRound,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import Link from "next/link";
import { CinematicBackground } from "@/components/ui/CinematicBackground";
import { StatusBar } from "@/components/ui/StatusBar";
import { Logo } from "@/components/ui/Logo";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useI18n } from "@/components/i18n/I18nProvider";
import { RecoverUidModal } from "./RecoverUidModal";
import { AnimatePresence as RecoverPresence } from "framer-motion";

const REMEMBER_KEY = "aegis:remember:uid";

export function LoginClient() {
  const router = useRouter();
  const { t } = useI18n();
  const [uid, setUid] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState<
    "idle" | "scanning" | "denied" | "granted"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [showRecover, setShowRecover] = useState(false);
  const [remember, setRemember] = useState(true);

  // Restore the remembered UID on mount.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(REMEMBER_KEY);
      if (saved && /^[0-9]{6,12}$/.test(saved)) {
        setUid(saved);
        setRemember(true);
      } else {
        setRemember(false);
      }
    } catch {
      /* ignore */
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[0-9]{6,12}$/.test(uid)) {
      setError(t.auth.login.uidInvalid);
      return;
    }
    if (!password) {
      setError(t.auth.login.passwordRequired);
      return;
    }
    setStage("scanning");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStage("denied");
        setTimeout(() => setStage("idle"), 1400);
        setError(data.error ?? t.auth.login.authFailed);
        return;
      }
      // Persist UID if the user opted in.
      try {
        if (remember) {
          window.localStorage.setItem(REMEMBER_KEY, uid);
        } else {
          window.localStorage.removeItem(REMEMBER_KEY);
        }
      } catch {
        /* ignore */
      }
      // brief "granted" frame before navigating
      setStage("granted");
      setTimeout(() => {
        startTransition(() => router.push("/dashboard"));
      }, 700);
    } catch {
      setStage("denied");
      setTimeout(() => setStage("idle"), 1200);
      setError(t.common.networkError);
    }
  }

  return (
    <main className="relative min-h-screen flex flex-col">
      <CinematicBackground variant="auth" />

      {/* Top bar */}
      <header className="px-5 sm:px-8 py-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo size={32} />
          <div>
            <div className="font-display tracking-[0.3em] text-emerald-glow text-glow text-sm">
              AEGIS
            </div>
            <div className="label-mono">{t.auth.classifiedAccessPortal}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <div className="hidden md:block">
            <StatusBar />
          </div>
        </div>
      </header>

      <section className="flex-1 grid lg:grid-cols-[1.1fr_1fr] gap-6 sm:gap-10 px-5 sm:px-8 pb-8 items-center">
        {/* Branding column */}
        <div className="hidden lg:block max-w-xl pl-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="badge mb-6">
              <ShieldCheck size={11} /> RESTRICTED · LEVEL 5
            </div>
            <h1 className="font-display text-4xl xl:text-5xl tracking-[0.12em] uppercase leading-[1.1] text-white">
              {t.auth.login.tagline1}
              <br />
              <span className="text-emerald-glow text-glow">
                {t.auth.login.tagline2}
              </span>
              <br />
              {t.auth.login.tagline3}
            </h1>
            <p className="mt-6 max-w-md text-white/60 text-sm leading-relaxed">
              {t.auth.login.taglineDesc}
            </p>
            <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
              {[
                ["DOSSIERS", "1,284"],
                ["AGENTS", "0,341"],
                ["UPLINKS", "12"],
              ].map(([k, v]) => (
                <div key={k} className="surface px-3 py-3">
                  <div className="label-mono">{k}</div>
                  <div className="font-display text-emerald-glow text-glow tracking-widest text-lg">
                    {v}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
              ID: 0xA17F · NODE EU-NORTH-3 · SHARD ▲
            </div>
          </motion.div>
        </div>

        {/* Login card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative w-full max-w-md mx-auto"
        >
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-emerald-glow/30 via-transparent to-emerald-glow/10 opacity-60 blur-xl" />
          <div className="relative surface-strong overflow-hidden rounded-2xl">
            {/* top accent */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-glow to-transparent" />

            {/* scanning beam */}
            <AnimatePresence>
              {stage === "scanning" && (
                <motion.div
                  initial={{ y: "-100%" }}
                  animate={{ y: "120%" }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.4, ease: "linear" }}
                  className="pointer-events-none absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-emerald-glow/25 to-transparent blur-md"
                />
              )}
            </AnimatePresence>

            <div className="p-6 sm:p-8 relative">
              <div className="flex items-center gap-2 mb-6">
                <div className="badge">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-glow animate-pulseDot" />
                  {t.auth.secureTerminal}
                </div>
                <div className="ml-auto label-mono">v1.0 · OP/AEGIS</div>
              </div>

              <h2 className="heading-display text-xl text-white mb-1">
                {t.auth.login.heading}
              </h2>
              <p className="text-white/50 text-xs">
                {t.auth.login.subheading}
              </p>

              <form onSubmit={submit} className="mt-6 space-y-4">
                <Field
                  label={t.auth.login.uidLabel}
                  icon={<Fingerprint size={14} />}
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setShowRecover(true)}
                      className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-glow/80 hover:text-emerald-glow"
                    >
                      {t.auth.recoverUid.trigger}
                    </button>
                  }
                >
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="username"
                    placeholder="••••••••"
                    value={uid}
                    onChange={(e) =>
                      setUid(e.target.value.replace(/\D/g, "").slice(0, 12))
                    }
                    className="field-mono text-lg"
                  />
                </Field>

                <Field
                  label={t.auth.login.passwordLabel}
                  icon={<KeyRound size={14} />}
                  hint={t.auth.login.passwordHint}
                >
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="field pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      tabIndex={-1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/50 hover:text-white"
                      aria-label="Toggle password visibility"
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </Field>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 text-warning text-xs font-mono uppercase tracking-wider"
                    >
                      <ShieldAlert size={14} />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <label className="flex items-center gap-2.5 text-xs font-mono uppercase tracking-[0.16em] text-white/55 hover:text-white/85 cursor-pointer select-none transition">
                  <span className="relative inline-flex h-4 w-4">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-sm border border-white/20 bg-white/[0.03] peer-checked:bg-emerald-glow/20 peer-checked:border-emerald-glow/60 peer-checked:shadow-[0_0_8px_rgba(16,245,168,0.4)] transition"
                    />
                    <svg
                      aria-hidden
                      className="absolute inset-0 m-auto h-3 w-3 text-emerald-glow opacity-0 peer-checked:opacity-100 transition"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M3 8.5L6.5 12L13 4.5"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span>{t.common.rememberUid}</span>
                </label>

                <button
                  type="submit"
                  disabled={pending || stage === "scanning" || stage === "granted"}
                  className="btn-primary w-full text-sm h-11"
                >
                  {stage === "scanning" && (
                    <span className="font-mono uppercase tracking-[0.2em]">
                      {t.auth.login.verifying}
                    </span>
                  )}
                  {stage === "granted" && (
                    <span className="font-mono uppercase tracking-[0.2em]">
                      {t.auth.login.granted}
                    </span>
                  )}
                  {(stage === "idle" || stage === "denied") && (
                    <>
                      {t.auth.login.submit}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 dotted-divider h-px w-full" />

              <div className="mt-5 flex items-center justify-between">
                <span className="label-mono">{t.auth.login.noClearance}</span>
                <Link
                  href="/register"
                  className="btn-ghost h-9 text-xs px-3 uppercase tracking-[0.18em] font-mono"
                >
                  {t.auth.login.requestEnrollment}
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>

            {/* bottom info strip */}
            <div className="border-t border-white/[0.05] px-6 sm:px-8 py-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
              <span>SESSION · 0xC3 · TLS-1.3</span>
              <span>FAILED ATTEMPTS LOGGED</span>
            </div>
          </div>

          {/* Access denied flash */}
          <AnimatePresence>
            {stage === "denied" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-warning shadow-glow-warning flex items-center justify-center"
              >
                <div className="stamp">ACCESS DENIED</div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      <footer className="px-5 sm:px-8 py-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">
        <span>© AEGIS / EDUCATIONAL DEPLOYMENT</span>
        <span>UNAUTHORIZED ACCESS PROHIBITED</span>
      </footer>

      <RecoverPresence>
        {showRecover && (
          <RecoverUidModal
            onClose={() => setShowRecover(false)}
            onPickUid={(value) => setUid(value)}
          />
        )}
      </RecoverPresence>
    </main>
  );
}

function Field({
  label,
  icon,
  hint,
  rightSlot,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <span className="label-mono flex items-center gap-1.5">
          <span className="text-emerald-glow">{icon}</span>
          {label}
        </span>
        {rightSlot ?? (
          hint && (
            <span className="font-mono text-[10px] text-white/30">{hint}</span>
          )
        )}
      </div>
      {children}
    </label>
  );
}
