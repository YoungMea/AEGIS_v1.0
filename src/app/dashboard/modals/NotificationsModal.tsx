"use client";
import { motion } from "framer-motion";
import { Bell, BellOff, Volume2, VolumeX, X, Check, AlertTriangle } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

interface Props {
  onClose: () => void;
}

/**
 * Lightweight settings modal where the user opts in/out of browser
 * notifications and sound effects. The actual permission prompt is the
 * browser's, we just trigger it.
 */
export function NotificationsModal({ onClose }: Props) {
  const { t } = useI18n();
  const {
    permission,
    enabled,
    sound,
    setEnabled,
    setSound,
    requestPermission,
    playBlip,
  } = useNotifications();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="surface-strong w-full max-w-md p-6 sm:p-7 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label={t.common.close}
          className="absolute top-3 right-3 h-8 w-8 grid place-items-center rounded text-white/55 hover:text-white"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Bell className="text-emerald-glow" size={18} />
          <h3 className="heading-display text-base text-white">
            {t.notifications.title}
          </h3>
        </div>

        <p className="text-white/55 text-xs mb-5">
          {t.notifications.subtitle}
        </p>

        {/* Permission status */}
        <PermissionRow permission={permission} onRequest={requestPermission} />

        <div className="dotted-divider h-px my-5" />

        {/* Toggles */}
        <ToggleRow
          icon={enabled ? <Bell size={16} /> : <BellOff size={16} />}
          title={t.notifications.notifyTitle}
          desc={t.notifications.notifyDesc}
          on={enabled}
          onChange={setEnabled}
          disabled={permission !== "granted"}
        />
        <div className="h-px bg-white/[0.05] my-3" />
        <ToggleRow
          icon={sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
          title={t.notifications.soundTitle}
          desc={t.notifications.soundDesc}
          on={sound}
          onChange={(v) => {
            setSound(v);
            if (v) playBlip("in");
          }}
        />

        <div className="dotted-divider h-px my-5" />

        <button
          type="button"
          onClick={() => playBlip("in")}
          className="btn-ghost w-full h-9 text-xs uppercase tracking-[0.18em] font-mono"
        >
          <Volume2 size={14} /> {t.notifications.testSound}
        </button>
      </motion.div>
    </motion.div>
  );
}

function PermissionRow({
  permission,
  onRequest,
}: {
  permission: "default" | "granted" | "denied" | "unsupported";
  onRequest: () => void;
}) {
  const { t } = useI18n();
  let content: React.ReactNode;
  if (permission === "granted") {
    content = (
      <span className="flex items-center gap-2 text-emerald-glow text-xs font-mono uppercase tracking-[0.18em]">
        <Check size={14} /> {t.notifications.permissionGranted}
      </span>
    );
  } else if (permission === "denied") {
    content = (
      <span className="flex items-center gap-2 text-warning text-xs font-mono uppercase tracking-[0.18em]">
        <AlertTriangle size={14} /> {t.notifications.permissionDenied}
      </span>
    );
  } else if (permission === "unsupported") {
    content = (
      <span className="flex items-center gap-2 text-white/40 text-xs font-mono uppercase tracking-[0.18em]">
        <AlertTriangle size={14} /> {t.notifications.permissionUnsupported}
      </span>
    );
  } else {
    content = (
      <button
        type="button"
        onClick={onRequest}
        className="btn-primary h-9 px-4 text-xs"
      >
        <Bell size={14} /> {t.notifications.permissionAsk}
      </button>
    );
  }
  return (
    <div className="surface p-3 flex items-center justify-between gap-3 flex-wrap">
      <div>
        <div className="label-mono">{t.notifications.permissionLabel}</div>
        <div className="text-[12px] text-white/55 mt-0.5 max-w-xs">
          {t.notifications.permissionHint}
        </div>
      </div>
      {content}
    </div>
  );
}

function ToggleRow({
  icon,
  title,
  desc,
  on,
  onChange,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        disabled && "opacity-50 pointer-events-none",
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        <span
          className={cn(
            "h-9 w-9 shrink-0 rounded-md grid place-items-center border",
            on
              ? "border-emerald-glow/40 text-emerald-glow bg-emerald-glow/[0.07]"
              : "border-white/10 text-white/40 bg-white/[0.02]",
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-[13px] text-white">{title}</div>
          <div className="text-[11.5px] text-white/45 leading-relaxed">
            {desc}
          </div>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={cn(
          "relative h-6 w-11 rounded-full border transition shrink-0",
          on
            ? "bg-emerald-glow/30 border-emerald-glow/60 shadow-[0_0_10px_rgba(16,245,168,0.4)]"
            : "bg-white/[0.06] border-white/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-4 w-4 rounded-full transition",
            on
              ? "translate-x-5 bg-emerald-glow shadow-[0_0_8px_rgba(16,245,168,0.7)]"
              : "translate-x-0 bg-white/40",
          )}
        />
      </button>
    </div>
  );
}
