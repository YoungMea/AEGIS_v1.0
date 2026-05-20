"use client";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  className?: string;
  pulse?: boolean;
}

/**
 * Stylized agency seal — minimal SVG, looks at home in classified UIs.
 */
export function Logo({ size = 28, className, pulse = true }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(pulse && "drop-shadow-[0_0_10px_rgba(16,245,168,0.35)]", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="aegis-grad" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#10F5A8" />
          <stop offset="100%" stopColor="#0AC97F" />
        </linearGradient>
      </defs>
      <circle
        cx="32"
        cy="32"
        r="28"
        stroke="url(#aegis-grad)"
        strokeWidth="1.5"
        opacity="0.6"
      />
      <circle
        cx="32"
        cy="32"
        r="22"
        stroke="url(#aegis-grad)"
        strokeWidth="0.8"
        opacity="0.4"
        strokeDasharray="2 4"
      />
      <path
        d="M32 8 L52 18 V34 C52 46 42 54 32 58 C22 54 12 46 12 34 V18 Z"
        stroke="url(#aegis-grad)"
        strokeWidth="1.4"
        fill="rgba(16,245,168,0.06)"
      />
      <path
        d="M24 32 L30 38 L42 24"
        stroke="#10F5A8"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="32" r="2.2" fill="#10F5A8" />
    </svg>
  );
}
