"use client";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScanLine,
  Camera,
  MapPin,
  Sparkles,
  FileText,
  Upload,
  X,
  Loader2,
  Image as ImageIcon,
  Globe2,
  Calendar,
  Aperture,
  Crosshair,
  Languages,
  RefreshCw,
  ExternalLink,
  Brain,
  AlertTriangle,
} from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import { cn, formatDate } from "@/lib/utils";

const MAX_BYTES = 7 * 1024 * 1024; // 7 MB raw image

interface ExifReadout {
  camera?: string;
  lens?: string;
  software?: string;
  takenAt?: string;
  iso?: number;
  focalLength?: string;
  aperture?: string;
  shutterSpeed?: string;
  orientation?: number;
  width?: number;
  height?: number;
  gps?: {
    lat: number;
    lng: number;
    altitude?: number;
    direction?: number;
  };
  rawKeys: string[];
}

interface AiAnalysis {
  summary: string;
  scene: string | null;
  objects: string[];
  textsFound: string[];
  geoGuess: {
    country?: string;
    region?: string;
    city?: string;
    confidence?: "low" | "medium" | "high";
    reasoning?: string;
  } | null;
}

interface AnalyzeResponse {
  exif: ExifReadout;
  ai: AiAnalysis | null;
  aiAvailable: boolean;
  aiProvider: string;
  aiSkippedReason: string | null;
}

interface OcrResult {
  text: string;
  confidence: number;
}

export function ImageIntelSection() {
  const { t } = useI18n();
  const toast = useToast();

  const [image, setImage] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{
    name: string;
    size: number;
  } | null>(null);

  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [drag, setDrag] = useState(false);

  /* ------------------------------ Upload */

  const ingest = useCallback(async (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError(t.intel.errorBadType);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(t.intel.errorTooBig);
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    setImage(dataUrl);
    setImageMeta({ name: file.name, size: file.size });
    setAnalysis(null);
    setOcr(null);
    void analyze(dataUrl, false);
  }, [t.intel.errorBadType, t.intel.errorTooBig]);

  /* ------------------------------ Analyze */

  async function analyze(dataUrl: string, useAi: boolean) {
    if (useAi) setAiBusy(true);
    else setAnalyzing(true);
    try {
      const res = await fetch("/api/intel/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, useAi }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.push({
          type: "error",
          title: t.intel.analyzeFailed,
          message: data.error,
        });
        return;
      }
      // Merge: keep previous AI if this run didn't request it.
      setAnalysis((prev) =>
        prev && !useAi
          ? { ...data, ai: prev.ai }
          : (data as AnalyzeResponse),
      );
    } catch {
      toast.push({ type: "error", title: t.common.networkError });
    } finally {
      setAnalyzing(false);
      setAiBusy(false);
    }
  }

  async function runOcr() {
    if (!image) return;
    setOcrBusy(true);
    setOcr(null);
    try {
      // Lazy-load tesseract.js so the cold tab doesn't pay the 4 MB cost.
      const mod = await import("tesseract.js");
      const result = await mod.default.recognize(image, "eng", {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        logger: () => {},
      });
      setOcr({
        text: result.data.text.trim(),
        confidence: result.data.confidence ?? 0,
      });
    } catch (e) {
      toast.push({
        type: "error",
        title: t.intel.ocrFailed,
        message: (e as Error).message,
      });
    } finally {
      setOcrBusy(false);
    }
  }

  function reset() {
    setImage(null);
    setImageMeta(null);
    setAnalysis(null);
    setOcr(null);
    setError(null);
  }

  /* ------------------------------ Render */

  const gps = analysis?.exif.gps ?? null;
  const geoGuess = analysis?.ai?.geoGuess ?? null;

  return (
    <div className="pt-6 max-w-5xl mx-auto pb-12">
      <div className="text-center max-w-2xl mx-auto mb-7">
        <div className="badge inline-flex mb-3">
          <ScanLine size={11} /> {t.intel.badge}
        </div>
        <h1 className="font-display tracking-[0.16em] uppercase text-2xl sm:text-3xl text-white">
          {t.intel.titlePart1}{" "}
          <span className="text-emerald-glow text-glow">{t.intel.titlePart2}</span>
        </h1>
        <p className="text-white/45 text-xs mt-2 leading-relaxed">
          {t.intel.subtitle}
        </p>
      </div>

      {/* Drop area / preview */}
      {!image ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void ingest(f);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "relative cursor-pointer rounded-2xl border-2 border-dashed transition group",
            "min-h-[300px] grid place-items-center text-center px-6",
            drag
              ? "border-emerald-glow/60 bg-emerald-glow/[0.05] shadow-glow-emerald"
              : "border-white/15 bg-white/[0.02] hover:bg-white/[0.04]",
          )}
        >
          <div>
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-glow/10 border border-emerald-glow/30 grid place-items-center group-hover:scale-105 transition">
              <ImageIcon size={28} className="text-emerald-glow" />
            </div>
            <h3 className="mt-4 heading-display text-base text-white">
              {t.intel.dropTitle}
            </h3>
            <p className="mt-1 text-white/45 text-xs max-w-sm mx-auto">
              {t.intel.dropDesc}
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
              <Upload size={11} />
              {t.intel.dropHint}
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void ingest(f);
              if (e.currentTarget) e.currentTarget.value = "";
            }}
          />
        </div>
      ) : (
        <div className="grid lg:grid-cols-[420px_1fr] gap-5">
          {/* Image preview */}
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden border border-emerald-glow/30 bg-ink-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" className="w-full h-auto block" />
              <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-2">
                <span className="badge bg-black/60 backdrop-blur">
                  <Crosshair size={10} /> {t.intel.targetTag}
                </span>
                <button
                  type="button"
                  onClick={reset}
                  aria-label={t.common.close}
                  className="h-8 w-8 grid place-items-center rounded bg-black/60 backdrop-blur text-white/85 hover:text-warning"
                >
                  <X size={14} />
                </button>
              </div>
              <AnimatePresence>
                {(analyzing || aiBusy || ocrBusy) && (
                  <motion.div
                    initial={{ y: "-30%" }}
                    animate={{ y: "120%" }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                    className="pointer-events-none absolute inset-x-0 h-20 bg-gradient-to-b from-transparent via-emerald-glow/30 to-transparent blur-md"
                  />
                )}
              </AnimatePresence>
            </div>

            {imageMeta && (
              <div className="surface px-3 py-2 font-mono text-[11px] text-white/55 flex items-center justify-between gap-2">
                <span className="truncate">{imageMeta.name}</span>
                <span className="shrink-0">
                  {(imageMeta.size / 1024).toFixed(1)} KB
                </span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => image && analyze(image, false)}
                disabled={analyzing}
                className="btn-ghost h-9 text-[10px] uppercase tracking-[0.18em] font-mono flex-1"
              >
                {analyzing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <RefreshCw size={12} />
                )}
                {t.intel.rerunMetadata}
              </button>
              <button
                type="button"
                onClick={runOcr}
                disabled={ocrBusy}
                className="btn-ghost h-9 text-[10px] uppercase tracking-[0.18em] font-mono flex-1"
              >
                {ocrBusy ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Languages size={12} />
                )}
                {t.intel.runOcr}
              </button>
            </div>

            <button
              type="button"
              onClick={() => image && analyze(image, true)}
              disabled={aiBusy || !analysis?.aiAvailable}
              className={cn(
                "btn-primary h-10 w-full text-[11px] uppercase tracking-[0.2em] font-mono",
                analysis && !analysis.aiAvailable && "opacity-60",
              )}
            >
              {aiBusy ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {t.intel.aiRunning}
                </>
              ) : (
                <>
                  <Brain size={14} />
                  {t.intel.runAi}
                </>
              )}
            </button>
            {analysis && !analysis.aiAvailable && (
              <div className="surface border-amber-glow/30 bg-amber-glow/[0.05] p-2.5 flex items-start gap-2 text-[11px] text-amber-glow font-mono uppercase tracking-[0.18em]">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>{t.intel.aiUnavailable}</span>
              </div>
            )}
          </div>

          {/* Panels */}
          <div className="space-y-4">
            {error && (
              <div className="surface border-warning/40 bg-warning/[0.06] p-3 text-warning text-xs font-mono uppercase tracking-wider">
                ▸ {error}
              </div>
            )}

            {/* AI analysis */}
            <Panel
              title={t.intel.aiTitle}
              icon={<Brain size={14} />}
              accent
              loading={aiBusy}
            >
              {analysis?.ai ? (
                <AiAnalysisView ai={analysis.ai} />
              ) : aiBusy ? (
                <SkeletonRows rows={3} />
              ) : (
                <div className="text-white/45 text-[12px]">
                  {analysis?.aiAvailable
                    ? t.intel.aiHint
                    : t.intel.aiUnavailable}
                </div>
              )}
            </Panel>

            {/* Geolocation */}
            <Panel
              title={t.intel.geoTitle}
              icon={<MapPin size={14} />}
              loading={analyzing}
            >
              {gps ? (
                <GpsView
                  lat={gps.lat}
                  lng={gps.lng}
                  altitude={gps.altitude}
                  direction={gps.direction}
                  source="exif"
                />
              ) : geoGuess && (geoGuess.country || geoGuess.city) ? (
                <GeoGuessView guess={geoGuess} />
              ) : (
                <div className="text-white/45 text-[12px]">
                  {t.intel.geoEmpty}
                </div>
              )}
            </Panel>

            {/* EXIF */}
            <Panel
              title={t.intel.metaTitle}
              icon={<Camera size={14} />}
              loading={analyzing}
            >
              {analysis ? (
                <ExifView exif={analysis.exif} />
              ) : (
                <SkeletonRows rows={3} />
              )}
            </Panel>

            {/* OCR */}
            <Panel
              title={t.intel.ocrTitle}
              icon={<FileText size={14} />}
              loading={ocrBusy}
            >
              {ocr ? (
                <div className="space-y-2">
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
                    {t.intel.ocrConfidence} ·{" "}
                    {Math.round(ocr.confidence)}%
                  </div>
                  <pre className="whitespace-pre-wrap break-words font-mono text-[12px] text-white/85 max-h-72 overflow-auto">
                    {ocr.text || t.intel.ocrEmpty}
                  </pre>
                </div>
              ) : (
                <div className="text-white/45 text-[12px]">
                  {t.intel.ocrHint}
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({
  title,
  icon,
  accent,
  loading,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  accent?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "surface-strong rounded-xl p-4 sm:p-5",
        accent && "border-emerald-glow/30",
      )}
    >
      <header className="flex items-center gap-2 mb-3">
        <span
          className={cn(
            "h-7 w-7 rounded-md grid place-items-center border",
            accent
              ? "border-emerald-glow/40 bg-emerald-glow/[0.07] text-emerald-glow"
              : "border-white/10 text-emerald-glow/85",
          )}
        >
          {icon}
        </span>
        <h3 className="font-display tracking-[0.14em] uppercase text-sm text-white">
          {title}
        </h3>
        {loading && (
          <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.22em] text-emerald-glow flex items-center gap-1">
            <Loader2 size={10} className="animate-spin" />
            ANALYZING
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded bg-white/[0.04] loading-bar"
          style={{ width: `${50 + Math.random() * 40}%` }}
        />
      ))}
    </div>
  );
}

function ExifView({ exif }: { exif: ExifReadout }) {
  const items: { label: string; value?: string | number; icon?: React.ReactNode }[] = [
    { label: "CAMERA", value: exif.camera, icon: <Camera size={11} /> },
    { label: "LENS", value: exif.lens, icon: <Aperture size={11} /> },
    { label: "TAKEN", value: exif.takenAt, icon: <Calendar size={11} /> },
    { label: "ISO", value: exif.iso },
    { label: "FOCAL", value: exif.focalLength },
    { label: "APERTURE", value: exif.aperture },
    { label: "SHUTTER", value: exif.shutterSpeed },
    {
      label: "DIMENSIONS",
      value:
        exif.width && exif.height ? `${exif.width} × ${exif.height}` : undefined,
    },
    { label: "SOFTWARE", value: exif.software },
  ].filter((x) => x.value !== undefined && x.value !== null && x.value !== "");

  if (items.length === 0) {
    return (
      <div className="text-white/45 text-[12px] flex items-center gap-2">
        <AlertTriangle size={12} className="text-amber-glow" />
        EXIF metadata stripped or unavailable
      </div>
    );
  }

  return (
    <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 text-[12.5px]">
      {items.map((it) => (
        <div key={it.label} className="flex items-baseline gap-2 min-w-0">
          <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40 w-24 shrink-0 flex items-center gap-1">
            {it.icon}
            {it.label}
          </dt>
          <dd className="text-white/85 font-mono text-[12px] truncate">
            {String(it.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function GpsView({
  lat,
  lng,
  altitude,
  direction,
  source,
}: {
  lat: number;
  lng: number;
  altitude?: number;
  direction?: number;
  source: "exif" | "ai";
}) {
  const { t } = useI18n();
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`;
  return (
    <div className="space-y-3">
      <div className="badge-ok w-fit">
        {source === "exif" ? t.intel.gpsFromExif : t.intel.gpsFromAi}
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        <KvBox label="LAT" value={lat.toFixed(6)} />
        <KvBox label="LNG" value={lng.toFixed(6)} />
        {typeof altitude === "number" && (
          <KvBox label="ALT" value={`${altitude.toFixed(0)} m`} />
        )}
        {typeof direction === "number" && (
          <KvBox label="HEADING" value={`${direction.toFixed(0)}°`} />
        )}
      </div>
      {/* Static OSM tile preview — no API key, free for sensible usage. */}
      <div className="rounded-md overflow-hidden border border-white/10 bg-ink-200">
        <iframe
          title="map"
          loading="lazy"
          className="w-full h-56"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01}%2C${lat - 0.01}%2C${lng + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost h-8 text-[10px] uppercase tracking-[0.18em] font-mono"
        >
          <ExternalLink size={11} /> {t.intel.openInMaps}
        </a>
        <a
          href={osmUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost h-8 text-[10px] uppercase tracking-[0.18em] font-mono"
        >
          <Globe2 size={11} /> OSM
        </a>
      </div>
    </div>
  );
}

function GeoGuessView({
  guess,
}: {
  guess: NonNullable<AiAnalysis["geoGuess"]>;
}) {
  const { t } = useI18n();
  const parts = [guess.city, guess.region, guess.country].filter(Boolean);
  const confidenceTone =
    guess.confidence === "high"
      ? "text-emerald-glow border-emerald-glow/40 bg-emerald-glow/[0.06]"
      : guess.confidence === "medium"
        ? "text-amber-glow border-amber-glow/40 bg-amber-glow/[0.06]"
        : "text-white/55 border-white/15";
  const queryUrl = `https://www.google.com/maps/search/${encodeURIComponent(parts.join(", "))}`;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge bg-emerald-glow/[0.06] border-emerald-glow/30 text-emerald-glow">
          <Sparkles size={10} /> {t.intel.gpsFromAi}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]",
            confidenceTone,
          )}
        >
          {t.intel.confidenceLabel} ·{" "}
          {(guess.confidence ?? "low").toUpperCase()}
        </span>
      </div>
      <div className="text-[18px] font-display tracking-[0.1em] uppercase text-white">
        {parts.join(", ") || "—"}
      </div>
      {guess.reasoning && (
        <p className="text-white/65 text-[12.5px] leading-relaxed">
          {guess.reasoning}
        </p>
      )}
      {parts.length > 0 && (
        <a
          href={queryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost h-8 text-[10px] uppercase tracking-[0.18em] font-mono w-fit"
        >
          <ExternalLink size={11} /> {t.intel.openInMaps}
        </a>
      )}
    </div>
  );
}

function AiAnalysisView({ ai }: { ai: AiAnalysis }) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      {ai.summary && (
        <p className="text-white/85 text-[13.5px] leading-relaxed">
          {ai.summary}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ai.scene && (
          <KvBox label={t.intel.sceneLabel} value={ai.scene.toUpperCase()} />
        )}
        {ai.objects.length > 0 && (
          <div className="surface px-3 py-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
              {t.intel.objectsLabel}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {ai.objects.slice(0, 12).map((o, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-emerald-glow/[0.07] border border-emerald-glow/30 text-emerald-glow"
                >
                  {o}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      {ai.textsFound.length > 0 && (
        <div className="surface px-3 py-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40 mb-1.5">
            {t.intel.textsLabel}
          </div>
          <ul className="space-y-1 font-mono text-[12px] text-white/85">
            {ai.textsFound.slice(0, 8).map((s, i) => (
              <li key={i} className="break-words">
                <span className="text-emerald-glow">▸</span> {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function KvBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
        {label}
      </div>
      <div className="font-mono text-[13px] text-white mt-0.5 break-all">
        {value}
      </div>
    </div>
  );
}
