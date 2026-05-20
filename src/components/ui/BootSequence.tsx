"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";

const LINES = [
  "init: secure boot ▸ kernel/3.7.12-aegis",
  "auth: requesting handshake ▸ TLS-1.3 ▸ ED25519",
  "telemetry: clearance check ▸ CONFIDENTIAL",
  "vault: decrypting case index ▸ AES-256-GCM",
  "ready: AEGIS terminal online",
];

/**
 * One-shot boot sequence shown before the dashboard mounts.
 * Stores a marker so it appears at most once per tab session.
 */
export function BootSequence({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("aegis:booted")) {
      setHidden(true);
      onDone();
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setStep(i);
      if (i >= LINES.length) {
        clearInterval(id);
        setTimeout(() => {
          sessionStorage.setItem("aegis:booted", "1");
          setHidden(true);
          onDone();
        }, 600);
      }
    }, 380);
    return () => clearInterval(id);
  }, [onDone]);

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-50"
        >
          <div className="absolute inset-0 grid-overlay opacity-50" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-glow to-transparent" />
          <div className="relative w-[min(640px,90vw)]">
            <div className="flex items-center gap-3 mb-6">
              <Logo size={36} />
              <div>
                <div className="font-display tracking-[0.3em] text-emerald-glow text-glow text-sm">
                  AEGIS
                </div>
                <div className="label-mono">SECURE TERMINAL // INITIALIZING</div>
              </div>
            </div>
            <div className="font-mono text-xs leading-7 text-white/70 panel-dark p-5 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-glow/60 to-transparent animate-pulseDot" />
              {LINES.slice(0, step).map((l, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex gap-3"
                >
                  <span className="text-emerald-glow">▸</span>
                  <span>{l}</span>
                </motion.div>
              ))}
              {step < LINES.length && (
                <div className="text-emerald-glow caret">_</div>
              )}
            </div>
            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(step / LINES.length) * 100}%` }}
                className="h-full bg-emerald-glow shadow-[0_0_18px_rgba(16,245,168,0.6)]"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
