"use client";

/**
 * Decorative pseudo-barcode generated deterministically from a string seed.
 */
export function Barcode({
  value,
  height = 28,
  className,
}: {
  value: string;
  height?: number;
  className?: string;
}) {
  // Hash to a sequence of bar widths (1–3px), 80 bars total.
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  const bars: number[] = [];
  let seed = h || 1;
  for (let i = 0; i < 80; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    bars.push(1 + (seed % 3));
  }

  return (
    <div className={className}>
      <div className="flex items-end gap-[1px]" style={{ height }}>
        {bars.map((w, i) => (
          <div
            key={i}
            style={{ width: w, height: i % 7 === 0 ? height : height - 4 }}
            className={i % 2 === 0 ? "bg-white/85" : "bg-transparent"}
          />
        ))}
      </div>
      <div className="font-mono text-[9px] tracking-[0.4em] text-white/60 mt-1">
        {value}
      </div>
    </div>
  );
}
