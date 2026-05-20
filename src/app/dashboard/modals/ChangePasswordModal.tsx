"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, X, Loader2 } from "lucide-react";
import { PasswordStrength, evaluatePassword } from "@/components/ui/PasswordStrength";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/components/i18n/I18nProvider";

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError(t.auth.changePassword.mismatch);
      return;
    }
    if (evaluatePassword(next).score < 3) {
      setError(t.auth.register.strengthError);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t.auth.changePassword.currentIncorrect);
        return;
      }
      toast.push({
        type: "success",
        title: t.auth.changePassword.success,
        message: t.auth.changePassword.successDesc,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="surface-strong w-full max-w-md p-6 sm:p-7 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 h-8 w-8 grid place-items-center rounded text-white/50 hover:text-white"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="text-emerald-glow" size={18} />
          <h3 className="heading-display text-base text-white">
            {t.auth.changePassword.title}
          </h3>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Field label={t.auth.changePassword.currentLabel}>
            <input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="field"
            />
          </Field>
          <Field label={t.auth.changePassword.newLabel}>
            <input
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="field"
            />
            <PasswordStrength value={next} />
          </Field>
          <Field label={t.auth.changePassword.confirmLabel}>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="field"
            />
          </Field>

          {error && (
            <div className="text-warning text-xs font-mono uppercase tracking-wider">
              ▸ {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost h-9 text-xs uppercase tracking-[0.18em] font-mono"
            >
              {t.common.cancel}
            </button>
            <button type="submit" disabled={busy} className="btn-primary h-9">
              {busy ? <Loader2 size={14} className="animate-spin" /> : null}
              {t.auth.changePassword.rotate}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="label-mono mb-1.5">{label}</div>
      {children}
    </label>
  );
}
