"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Map as MapIcon,
  Loader2,
  RefreshCw,
  Layers,
  Filter,
  ShieldAlert,
  ExternalLink,
  Globe2,
  X,
} from "lucide-react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn, formatDate } from "@/lib/utils";

// Leaflet's CSS is imported dynamically so it only loads when this section
// mounts (saves ~16 KB on the first paint of every other tab).
let leafletCssLoaded = false;
async function ensureLeafletCss() {
  if (leafletCssLoaded || typeof document === "undefined") return;
  if (document.querySelector('link[data-aegis-leaflet]')) {
    leafletCssLoaded = true;
    return;
  }
  await new Promise<void>((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.crossOrigin = "anonymous";
    link.integrity =
      "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
    link.dataset.aegisLeaflet = "1";
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
  leafletCssLoaded = true;
}

interface MarkerDossier {
  id: string;
  ref: string;
  fullName: string | null;
  alias: string | null;
  classification: string;
  riskLevel: string;
  status: string;
  city: string | null;
  country: string | null;
  updatedAt: number;
}

interface WingMarker {
  query: string;
  lat: number;
  lng: number;
  city: string | null;
  country: string | null;
  highestRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  count: number;
  dossiers: MarkerDossier[];
}

const RISK_TONE: Record<string, { color: string; ring: string }> = {
  LOW: { color: "#10F5A8", ring: "rgba(16,245,168,0.25)" },
  MEDIUM: { color: "#FFB020", ring: "rgba(255,176,32,0.25)" },
  HIGH: { color: "#FF6B6B", ring: "rgba(255,107,107,0.25)" },
  CRITICAL: { color: "#FF3D3D", ring: "rgba(255,61,61,0.35)" },
};

export function WingSection() {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<Marker[]>([]);

  const [markers, setMarkers] = useState<WingMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState<string>("ALL");
  const [active, setActive] = useState<WingMarker | null>(null);

  /* ------------------------------ Init map */

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    (async () => {
      await ensureLeafletCss();
      if (cancelled) return;
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      // Centre roughly on Eurasia by default.
      map = L.map(containerRef.current, {
        center: [41.3, 69.2],
        zoom: 3,
        worldCopyJump: true,
        zoomControl: true,
        attributionControl: false,
      });

      // Dark CARTO basemap — matches AEGIS's tactical aesthetic better than
      // the standard OSM tiles. Free, no API key, works on Render free tier.
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        {
          subdomains: "abcd",
          maxZoom: 19,
          attribution: "© OpenStreetMap · © CARTO",
        },
      ).addTo(map);

      // Render the attribution as an emerald, monospace overlay so it
      // matches AEGIS's tactical UI without the default white box.
      L.control
        .attribution({ position: "bottomright", prefix: false })
        .addTo(map);

      mapRef.current = map;

      // Trigger first data load.
      void load();
    })();

    return () => {
      cancelled = true;
      try {
        map?.remove();
      } catch {
        /* ignore */
      }
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------ Load markers */

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/wing/markers");
      if (!res.ok) return;
      const data = (await res.json()) as { markers: WingMarker[] };
      setMarkers(data.markers ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ------------------------------ Project markers */

  const filteredMarkers = useMemo(() => {
    if (riskFilter === "ALL") return markers;
    return markers.filter((m) => m.highestRisk === riskFilter);
  }, [markers, riskFilter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;

      // Wipe previous markers.
      for (const m of markerLayerRef.current) {
        try {
          m.remove();
        } catch {
          /* ignore */
        }
      }
      markerLayerRef.current = [];

      for (const data of filteredMarkers) {
        const tone = RISK_TONE[data.highestRisk] ?? RISK_TONE.LOW!;
        const html = `
          <div class="aegis-marker" style="
              --tone:${tone.color};
              --ring:${tone.ring};
            ">
            <span class="aegis-pulse"></span>
            <span class="aegis-dot">${data.count > 1 ? data.count : ""}</span>
          </div>`;
        const icon = L.divIcon({
          html,
          className: "aegis-divicon",
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        const marker = L.marker([data.lat, data.lng], { icon })
          .on("click", () => setActive(data))
          .addTo(map);
        markerLayerRef.current.push(marker);
      }

      if (filteredMarkers.length > 0) {
        const bounds = L.latLngBounds(
          filteredMarkers.map((m) => [m.lat, m.lng] as [number, number]),
        );
        if (filteredMarkers.length === 1) {
          map.setView([filteredMarkers[0]!.lat, filteredMarkers[0]!.lng], 8);
        } else {
          map.fitBounds(bounds.pad(0.15), { animate: false });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filteredMarkers]);

  /* ------------------------------ Stats */

  const stats = useMemo(() => {
    return {
      cities: markers.length,
      dossiers: markers.reduce((s, m) => s + m.count, 0),
      high: markers.filter(
        (m) => m.highestRisk === "HIGH" || m.highestRisk === "CRITICAL",
      ).length,
    };
  }, [markers]);

  /* ------------------------------ Render */

  return (
    <div className="pt-6 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <div className="badge inline-flex mb-2">
            <Globe2 size={11} /> {t.wing.badge}
          </div>
          <h1 className="font-display tracking-[0.16em] uppercase text-2xl sm:text-3xl text-white">
            {t.wing.titlePart1}
            <span className="text-emerald-glow text-glow">
              {t.wing.titlePart2}
            </span>
          </h1>
          <p className="text-white/45 text-xs mt-1.5 max-w-md">
            {t.wing.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Stat label={t.wing.cities} value={stats.cities.toString().padStart(3, "0")} />
          <Stat label={t.wing.statDossiers} value={stats.dossiers.toString().padStart(3, "0")} accent />
          <Stat
            label={t.wing.highRisk}
            value={stats.high.toString().padStart(3, "0")}
            warn={stats.high > 0}
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="surface-strong rounded-t-xl px-3 py-2 flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1 surface px-1 h-9 overflow-x-auto">
          <Filter size={13} className="text-white/40 ml-2 shrink-0" />
          {["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"].map((r) => (
            <button
              key={r}
              onClick={() => setRiskFilter(r)}
              className={cn(
                "px-2.5 h-7 rounded-md font-mono text-[10px] uppercase tracking-[0.18em] shrink-0",
                riskFilter === r
                  ? "bg-emerald-glow/15 text-emerald-glow border border-emerald-glow/40"
                  : "text-white/45 hover:text-white",
              )}
            >
              {r}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="btn-ghost h-9 text-[10px] uppercase tracking-[0.18em] font-mono"
        >
          {loading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          {t.wing.refresh}
        </button>

        <div className="ml-auto font-mono text-[10px] uppercase tracking-[0.22em] text-white/40 flex items-center gap-2">
          <Layers size={11} className="text-emerald-glow" />
          <span>OSM · DARK</span>
        </div>
      </div>

      {/* Map */}
      <div className="relative rounded-b-xl overflow-hidden border border-t-0 border-white/[0.06] bg-ink-200">
        <div
          ref={containerRef}
          className="w-full h-[60vh] min-h-[420px]"
          style={{ background: "#02050A" }}
        />

        {/* Empty state overlay */}
        {!loading && markers.length === 0 && (
          <div className="absolute inset-0 grid place-items-center bg-ink-100/85 backdrop-blur-sm pointer-events-none">
            <div className="text-center px-6">
              <MapIcon size={28} className="mx-auto text-emerald-glow/60" />
              <h3 className="mt-3 heading-display text-base text-white">
                {t.wing.emptyTitle}
              </h3>
              <p className="mt-1 text-white/45 text-xs max-w-sm">
                {t.wing.emptyDesc}
              </p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && markers.length === 0 && (
          <div className="absolute inset-0 grid place-items-center bg-ink-100/85 backdrop-blur-sm pointer-events-none">
            <div className="font-mono text-xs uppercase tracking-[0.22em] text-emerald-glow flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" />
              {t.wing.loading}
            </div>
          </div>
        )}

        {/* Active marker preview */}
        <AnimatePresence>
          {active && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute top-3 right-3 max-w-[320px] surface-strong rounded-xl p-4 z-[1000]"
            >
              <button
                onClick={() => setActive(null)}
                className="absolute top-2 right-2 h-7 w-7 grid place-items-center rounded text-white/55 hover:text-white"
                aria-label={t.common.close}
              >
                <X size={14} />
              </button>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: RISK_TONE[active.highestRisk]?.color }}
                />
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
                  RISK · {active.highestRisk}
                </span>
              </div>
              <div className="font-display tracking-[0.08em] uppercase text-base text-white truncate">
                {[active.city, active.country].filter(Boolean).join(", ") ||
                  active.query}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40 mt-0.5">
                {active.count} {t.wing.dossiersHere}
              </div>
              <ul className="mt-3 space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {active.dossiers.map((d) => (
                  <li
                    key={d.id}
                    className="surface px-2.5 py-2 text-[12px] flex items-start gap-2"
                  >
                    <ShieldAlert
                      size={11}
                      className={cn(
                        "mt-0.5 shrink-0",
                        d.riskLevel === "CRITICAL" || d.riskLevel === "HIGH"
                          ? "text-warning"
                          : d.riskLevel === "MEDIUM"
                            ? "text-amber-glow"
                            : "text-emerald-glow",
                      )}
                    />
                    <div className="min-w-0">
                      <div className="text-white/85 truncate">
                        {d.fullName ?? "—"}
                      </div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">
                        {d.ref} · {formatDate(d.updatedAt)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <a
                href={`https://www.openstreetmap.org/?mlat=${active.lat}&mlon=${active.lng}#map=10/${active.lat}/${active.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-glow hover:text-white"
              >
                <ExternalLink size={10} /> {t.wing.openInOsm}
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
        <span>{t.wing.legendLabel}</span>
        {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((r) => (
          <span key={r} className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: RISK_TONE[r].color }}
            />
            {r}
          </span>
        ))}
      </div>

      {/* Inline marker styles — Leaflet renders divIcon HTML as-is. */}
      <style jsx global>{`
        .aegis-divicon {
          background: transparent !important;
          border: none !important;
        }
        .aegis-marker {
          position: relative;
          width: 32px;
          height: 32px;
        }
        .aegis-pulse {
          position: absolute;
          inset: 4px;
          border-radius: 50%;
          background: var(--ring);
          animation: aegis-marker-pulse 2.4s ease-out infinite;
        }
        .aegis-dot {
          position: absolute;
          inset: 8px;
          border-radius: 50%;
          background: var(--tone);
          box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.6),
            0 0 12px var(--ring);
          color: #02060a;
          font-family: ui-monospace, SFMono-Regular, monospace;
          font-size: 10px;
          font-weight: 700;
          display: grid;
          place-items: center;
        }
        @keyframes aegis-marker-pulse {
          0% {
            transform: scale(0.8);
            opacity: 0.9;
          }
          100% {
            transform: scale(2.6);
            opacity: 0;
          }
        }
        /* Tactical attribution */
        .leaflet-control-attribution {
          background: rgba(5, 7, 10, 0.7) !important;
          color: rgba(255, 255, 255, 0.45) !important;
          font-family: ui-monospace, SFMono-Regular, monospace !important;
          font-size: 10px !important;
          padding: 2px 6px !important;
          border-radius: 6px !important;
        }
        .leaflet-control-attribution a {
          color: rgba(16, 245, 168, 0.7) !important;
        }
        .leaflet-control-zoom a {
          background: rgba(5, 7, 10, 0.85) !important;
          color: #10f5a8 !important;
          border: 1px solid rgba(16, 245, 168, 0.25) !important;
        }
      `}</style>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "surface px-4 py-2.5 min-w-[100px]",
        warn && "border-warning/30",
        accent && "border-emerald-glow/30",
      )}
    >
      <div className="label-mono">{label}</div>
      <div
        className={cn(
          "font-display tracking-widest text-lg",
          accent ? "text-emerald-glow text-glow" : warn ? "text-warning" : "text-white",
        )}
      >
        {value}
      </div>
    </div>
  );
}
