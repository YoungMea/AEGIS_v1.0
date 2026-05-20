"use client";
import { motion } from "framer-motion";

/**
 * Full-bleed cinematic background:
 *  • soft radial glow
 *  • animated grid drift
 *  • subtle scanline overlay
 *  • drifting "encrypted traffic" ticks (decorative)
 */
export function CinematicBackground({
  variant = "auth",
}: {
  variant?: "auth" | "app";
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Base gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_-10%,rgba(16,245,168,0.08),transparent_60%),radial-gradient(60%_60%_at_100%_100%,rgba(20,60,120,0.18),transparent_60%)]" />

      {/* Drifting grid */}
      <motion.div
        initial={{ backgroundPositionY: 0 }}
        animate={{ backgroundPositionY: 200 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 grid-overlay opacity-[0.5]"
        style={{ ["--grid-size" as string]: variant === "auth" ? "40px" : "32px" }}
      />

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_50%,transparent_30%,rgba(0,0,0,0.65)_100%)]" />

      {/* Top scan beam */}
      {variant === "auth" && (
        <motion.div
          initial={{ y: "-30%" }}
          animate={{ y: "120%" }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          className="absolute inset-x-0 h-40 bg-gradient-to-b from-transparent via-emerald-glow/[0.06] to-transparent blur-2xl"
        />
      )}

      {/* Corner brackets */}
      <Bracket pos="top-6 left-6 sm:top-8 sm:left-8" rotate={0} />
      <Bracket pos="top-6 right-6 sm:top-8 sm:right-8" rotate={90} />
      <Bracket pos="bottom-6 left-6 sm:bottom-8 sm:left-8" rotate={-90} />
      <Bracket pos="bottom-6 right-6 sm:bottom-8 sm:right-8" rotate={180} />

      {/* Scanlines */}
      <div className="absolute inset-0 bg-scanline opacity-[0.35] mix-blend-overlay" />
    </div>
  );
}

function Bracket({ pos, rotate }: { pos: string; rotate: number }) {
  return (
    <div
      className={`absolute ${pos} text-emerald-glow/40`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path
          d="M2 2H10M2 2V10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="square"
        />
      </svg>
    </div>
  );
}
