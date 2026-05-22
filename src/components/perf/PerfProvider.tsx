"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Performance tier auto-detection.
 *
 * The dashboard runs a lot of decorative animations (scan beams, drifting
 * grids, glowing borders, backdrop blurs). On underpowered devices these
 * cause visible jank. PerfProvider picks one of three tiers and exposes a
 * boolean for each "expensive" feature so components can opt in or out.
 *
 * Tiers
 *  • high   — full cinematic experience (default desktop)
 *  • medium — main animations on, scanlines/blur trimmed
 *  • low    — animations stripped, static backgrounds, no blur
 *
 * Detection inputs (best-effort, all gracefully degrade):
 *   - prefers-reduced-motion       → forces low
 *   - data-saver / save-data       → forces low
 *   - hardwareConcurrency ≤ 2      → suggests low
 *   - deviceMemory ≤ 2 GB          → suggests low
 *   - Connection effectiveType     → 2g/slow-2g forces low, 3g suggests medium
 *   - Touch + small viewport       → suggests medium for safety
 *
 * Users can override the auto choice from the profile menu; the choice is
 * persisted in localStorage.
 */

export type PerfTier = "low" | "medium" | "high";
export type PerfPreference = "auto" | PerfTier;

interface Ctx {
  tier: PerfTier;
  preference: PerfPreference;
  setPreference: (p: PerfPreference) => void;
  /** Auto-detected tier; useful for UI labels. */
  detected: PerfTier;
  /** Convenience flags so call sites stay readable. */
  flags: {
    animations: boolean; // any non-essential animation
    rich: boolean; // boot sequence, status bar tickers, scanline beams
    blur: boolean; // backdrop blur and glassmorphism
    grid: boolean; // animated drifting grid background
    scanlines: boolean; // overlay scanline effect
    motionReduced: boolean; // OS-level reduced motion
  };
}

const STORAGE_KEY = "aegis:perf";

const PerfCtx = createContext<Ctx | null>(null);

/* eslint-disable @typescript-eslint/no-explicit-any */
function detectTier(): { tier: PerfTier; reduced: boolean } {
  if (typeof window === "undefined")
    return { tier: "high", reduced: false };

  const reduced = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches ?? false;

  if (reduced) return { tier: "low", reduced: true };

  const nav = navigator as any;
  const conn = nav.connection || nav.webkitConnection || nav.mozConnection;

  if (conn?.saveData) return { tier: "low", reduced: false };

  const effective = conn?.effectiveType as string | undefined;
  if (effective === "slow-2g" || effective === "2g") {
    return { tier: "low", reduced: false };
  }

  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;

  if (cores <= 2 || memory <= 2) return { tier: "low", reduced: false };

  // 3g network, or modest mobile
  if (effective === "3g") return { tier: "medium", reduced: false };

  // Touch device with smaller viewport → conservative default
  const isTouch = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const isNarrow = window.innerWidth < 768;
  if (isTouch && isNarrow && (cores <= 4 || memory <= 4)) {
    return { tier: "medium", reduced: false };
  }

  return { tier: "high", reduced: false };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function flagsFor(tier: PerfTier, motionReduced: boolean) {
  if (tier === "low") {
    return {
      animations: false,
      rich: false,
      blur: false,
      grid: false,
      scanlines: false,
      motionReduced,
    };
  }
  if (tier === "medium") {
    return {
      animations: true,
      rich: false,
      blur: true,
      grid: true,
      scanlines: false,
      motionReduced,
    };
  }
  return {
    animations: true,
    rich: true,
    blur: true,
    grid: true,
    scanlines: true,
    motionReduced,
  };
}

export function PerfProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<PerfPreference>("auto");
  const [detected, setDetected] = useState<PerfTier>("high");
  const [motionReduced, setMotionReduced] = useState(false);

  // Initial detection on mount.
  useEffect(() => {
    const { tier, reduced } = detectTier();
    setDetected(tier);
    setMotionReduced(reduced);
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as PerfPreference | null;
      if (saved === "auto" || saved === "low" || saved === "medium" || saved === "high") {
        setPreferenceState(saved);
      }
    } catch {
      /* ignore */
    }

    // React to OS-level reduced-motion changes live.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setMotionReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const setPreference = useCallback((p: PerfPreference) => {
    setPreferenceState(p);
    try {
      window.localStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* ignore */
    }
  }, []);

  const tier: PerfTier = preference === "auto" ? detected : preference;
  const flags = useMemo(() => flagsFor(tier, motionReduced), [tier, motionReduced]);

  // Annotate <html> with a data attribute so plain CSS can react too.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.perf = tier;
  }, [tier]);

  const value = useMemo<Ctx>(
    () => ({ tier, preference, setPreference, detected, flags }),
    [tier, preference, setPreference, detected, flags],
  );

  return <PerfCtx.Provider value={value}>{children}</PerfCtx.Provider>;
}

export function usePerf(): Ctx {
  const ctx = useContext(PerfCtx);
  if (!ctx) throw new Error("usePerf must be used inside PerfProvider");
  return ctx;
}
