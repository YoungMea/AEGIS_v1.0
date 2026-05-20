"use client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Wifi, ShieldCheck, Radio } from "lucide-react";

/**
 * Decorative status bar that mimics a tactical operations console.
 * Lightweight — purely cosmetic, no real telemetry.
 */
export function StatusBar() {
  const [time, setTime] = useState<string>("--:--:--");
  const [latency, setLatency] = useState<number>(42);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(d.toISOString().slice(11, 19) + "Z");
      setLatency(30 + Math.round(Math.random() * 24));
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="flex items-center gap-3 sm:gap-5 text-[10px] font-mono uppercase tracking-[0.18em] text-white/50">
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-glow animate-pulseDot" />
        SECURE LINK
      </span>
      <span className="hidden sm:flex items-center gap-1.5">
        <ShieldCheck size={12} className="text-emerald-glow" />
        TLS-1.3
      </span>
      <span className="hidden md:flex items-center gap-1.5">
        <Wifi size={12} className="text-emerald-glow" />
        {latency}ms
      </span>
      <span className="hidden lg:flex items-center gap-1.5">
        <Radio size={12} className="text-emerald-glow" />
        CHANNEL ▉ ▉ ▉
      </span>
      <motion.span
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        className="ml-auto"
      >
        {time}
      </motion.span>
    </div>
  );
}
