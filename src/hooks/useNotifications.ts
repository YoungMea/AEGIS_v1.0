"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_ENABLED = "aegis:notify:enabled";
const STORAGE_SOUND = "aegis:notify:sound";

type Permission = "default" | "granted" | "denied" | "unsupported";

/**
 * Browser notifications + a small synthesised "blip" sound for new chat
 * messages.
 *
 *   - persistMode: store user opt-in flag in localStorage so it survives
 *     reloads. The page only fires Notification() if BOTH the flag is on
 *     and the OS-level permission is granted.
 *   - playSound: a tiny WebAudio click — no audio file shipped, no fetch.
 */
export function useNotifications() {
  const [permission, setPermission] = useState<Permission>("default");
  const [enabled, setEnabledState] = useState(true);
  const [sound, setSoundState] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as Permission);

    try {
      const e = window.localStorage.getItem(STORAGE_ENABLED);
      if (e !== null) setEnabledState(e === "1");
      const s = window.localStorage.getItem(STORAGE_SOUND);
      if (s !== null) setSoundState(s === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined") return "unsupported" as const;
    if (!("Notification" in window)) return "unsupported" as const;
    const result = await Notification.requestPermission();
    setPermission(result as Permission);
    return result;
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    try {
      window.localStorage.setItem(STORAGE_ENABLED, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const setSound = useCallback((v: boolean) => {
    setSoundState(v);
    try {
      window.localStorage.setItem(STORAGE_SOUND, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  /** Play a short synthesised tactical "blip" — no audio file required. */
  const playBlip = useCallback(
    (variant: "in" | "out" = "in") => {
      if (!sound) return;
      try {
        if (typeof window === "undefined") return;
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctx) return;
        if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") ctx.resume().catch(() => {});

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        // Higher pitch for incoming, slightly lower for outgoing.
        osc.frequency.setValueAtTime(variant === "in" ? 880 : 660, now);
        osc.frequency.exponentialRampToValueAtTime(
          variant === "in" ? 1320 : 880,
          now + 0.06,
        );
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      } catch {
        /* ignore — sound is a nice-to-have */
      }
    },
    [sound],
  );

  /**
   * Try to show a native notification. Falls back to nothing if the page
   * is already focused (foreground users see the in-app toasts instead).
   */
  const notify = useCallback(
    (
      title: string,
      opts: { body?: string; tag?: string; requireFocus?: boolean } = {},
    ) => {
      // Always click-noise so the user has audible feedback even when
      // notifications are denied.
      playBlip("in");

      if (!enabled) return;
      if (typeof window === "undefined") return;
      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      // Skip when the tab is already focused — toasts handle the foreground.
      if (
        opts.requireFocus !== false &&
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      ) {
        return;
      }
      try {
        const n = new Notification(title, {
          body: opts.body,
          tag: opts.tag,
          icon: "/favicon.ico",
          silent: true, // we handle sound ourselves
        });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      } catch {
        /* ignore */
      }
    },
    [enabled, playBlip],
  );

  return {
    permission,
    enabled,
    sound,
    requestPermission,
    setEnabled,
    setSound,
    notify,
    playBlip,
  };
}
