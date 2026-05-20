"use client";
import { useMemo } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";

export interface StrengthResult {
  score: number; // 0..4
  hints: ("min" | "upper" | "lower" | "digit")[];
}

export function evaluatePassword(pw: string): StrengthResult {
  const hints: StrengthResult["hints"] = [];
  let score = 0;
  if (pw.length >= 8) score++;
  else hints.push("min");
  if (/[A-Z]/.test(pw)) score++;
  else hints.push("upper");
  if (/[a-z]/.test(pw)) score++;
  else hints.push("lower");
  if (/[0-9]/.test(pw)) score++;
  else hints.push("digit");
  if (/[^A-Za-z0-9]/.test(pw) && pw.length >= 12) score = Math.min(4, score + 1);
  return { score, hints };
}

export function PasswordStrength({ value }: { value: string }) {
  const { t } = useI18n();
  const r = useMemo(() => evaluatePassword(value), [value]);

  const labels = [
    t.auth.register.strengthVeryWeak,
    t.auth.register.strengthWeak,
    t.auth.register.strengthFair,
    t.auth.register.strengthStrong,
    t.auth.register.strengthExcellent,
  ];
  const colors = [
    "text-warning",
    "text-warning",
    "text-amber-glow",
    "text-emerald-glow",
    "text-emerald-glow",
  ];
  const bars = [
    "bg-warning/70",
    "bg-warning/70",
    "bg-amber-glow",
    "bg-emerald-glow",
    "bg-emerald-glow",
  ];

  const hintLabels: Record<StrengthResult["hints"][number], string> = {
    min: t.auth.register.hintMin,
    upper: t.auth.register.hintUpper,
    lower: t.auth.register.hintLower,
    digit: t.auth.register.hintDigit,
  };

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="label-mono">{t.auth.register.passwordStrength}</span>
        <span className={`font-mono text-[10px] tracking-[0.22em] ${colors[r.score]}`}>
          {labels[r.score]}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i < r.score ? bars[r.score] : "bg-white/10"
            }`}
          />
        ))}
      </div>
      {r.hints.length > 0 && value.length > 0 && (
        <ul className="mt-2 space-y-0.5 font-mono text-[10px] text-white/40">
          {r.hints.map((h) => (
            <li key={h}>· {hintLabels[h]}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
