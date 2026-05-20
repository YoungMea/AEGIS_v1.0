import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx,js,jsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          0: "#000000",
          50: "#05070A",
          100: "#0A0D12",
          200: "#0F1318",
          300: "#141921",
          400: "#1B2230",
          500: "#222B3C",
          600: "#2A3548",
        },
        graphite: {
          DEFAULT: "#1A1F2A",
          light: "#252B38",
          dark: "#10141C",
        },
        navy: {
          DEFAULT: "#0B1220",
          deep: "#060A14",
          light: "#162035",
        },
        emerald: {
          glow: "#10F5A8",
          accent: "#0AC97F",
          deep: "#0B6B47",
        },
        warning: {
          DEFAULT: "#FF4D4D",
          deep: "#9B1F1F",
        },
        amber: {
          glow: "#FFB020",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "SFMono-Regular"],
        display: ["var(--font-orbitron)", "ui-sans-serif"],
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(to right, rgba(16,245,168,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(16,245,168,0.04) 1px, transparent 1px)",
        "grid-noise":
          "linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
        "radial-glow":
          "radial-gradient(circle at 50% 0%, rgba(16,245,168,0.10), transparent 60%)",
        "scanline":
          "repeating-linear-gradient(180deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 3px)",
      },
      boxShadow: {
        "glow-emerald": "0 0 0 1px rgba(16,245,168,0.25), 0 0 40px rgba(16,245,168,0.12)",
        "glow-emerald-strong": "0 0 0 1px rgba(16,245,168,0.5), 0 0 60px rgba(16,245,168,0.25)",
        "glow-warning": "0 0 0 1px rgba(255,77,77,0.4), 0 0 40px rgba(255,77,77,0.15)",
        "inset-line": "inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4)",
      },
      keyframes: {
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        flicker: {
          "0%,19.999%,22%,62.999%,64%,64.999%,70%,100%": { opacity: "1" },
          "20%,21.999%,63%,63.999%,65%,69.999%": { opacity: "0.4" },
        },
        pulseDot: {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.85)" },
        },
        boot: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        type: {
          from: { width: "0" },
          to: { width: "100%" },
        },
        glowPulse: {
          "0%,100%": { boxShadow: "0 0 0 1px rgba(16,245,168,0.25), 0 0 20px rgba(16,245,168,0.10)" },
          "50%": { boxShadow: "0 0 0 1px rgba(16,245,168,0.5), 0 0 60px rgba(16,245,168,0.25)" },
        },
      },
      animation: {
        scan: "scan 3.2s linear infinite",
        flicker: "flicker 4s infinite",
        pulseDot: "pulseDot 1.6s ease-in-out infinite",
        boot: "boot 0.6s ease-out both",
        shimmer: "shimmer 2.4s linear infinite",
        type: "type 1.6s steps(40,end) forwards",
        glowPulse: "glowPulse 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
