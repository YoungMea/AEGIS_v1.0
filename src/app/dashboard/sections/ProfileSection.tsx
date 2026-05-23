"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  UserCircle,
  Camera,
  X,
  Save,
  Loader2,
  Hash,
  Phone,
  Calendar,
  ShieldCheck,
} from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import type { SessionUserDto } from "../types";

const MAX_AVATAR_BYTES = 600 * 1024;

interface Props {
  user: SessionUserDto;
  onUpdated?: (next: SessionUserDto) => void;
}

export function ProfileSection({ user, onUpdated }: Props) {
  const { t } = useI18n();
  const toast = useToast();

  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // If parent passes a refreshed user (e.g. after a page-level refetch),
  // reseed local state.
  useEffect(() => {
    setDisplayName(user.displayName ?? "");
    setBio(user.bio ?? "");
    setAvatarUrl(user.avatarUrl ?? null);
  }, [user]);

  async function pickAvatar(file: File) {
    if (!file.type.startsWith("image/")) {
      setError(t.profile.avatarBadType);
      return;
    }
    if (file.size > MAX_AVATAR_BYTES * 4) {
      // 4x raw → still bigger than the encoded limit, reject early.
      setError(t.profile.avatarTooLarge);
      return;
    }
    setError(null);

    // Resize to a square 256x256 for compactness before encoding.
    const dataUrl = await downscaleToDataUrl(file, 256);
    if (dataUrl.length > MAX_AVATAR_BYTES) {
      setError(t.profile.avatarTooLarge);
      return;
    }
    setAvatarUrl(dataUrl);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          bio: bio.trim() || null,
          avatarUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t.common.networkError);
        return;
      }
      toast.push({
        type: "success",
        title: t.profile.savedTitle,
        message: t.profile.savedDesc,
      });
      onUpdated?.({
        ...user,
        displayName: data.profile.displayName,
        avatarUrl: data.profile.avatarUrl,
        bio: data.profile.bio,
      });
    } catch {
      setError(t.common.networkError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pt-6 max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <div className="badge inline-flex mb-3">
          <UserCircle size={11} /> {t.profile.badge}
        </div>
        <h1 className="font-display tracking-[0.16em] uppercase text-2xl sm:text-3xl text-white">
          {t.profile.titlePart1}{" "}
          <span className="text-emerald-glow text-glow">
            {t.profile.titlePart2}
          </span>
        </h1>
        <p className="text-white/45 text-xs mt-1.5">{t.profile.subtitle}</p>
      </div>

      <div className="surface-strong rounded-2xl p-5 sm:p-7">
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          {/* Avatar */}
          <div className="relative shrink-0 mx-auto sm:mx-0">
            <div className="h-28 w-28 rounded-full overflow-hidden border-2 border-emerald-glow/40 bg-emerald-glow/10 grid place-items-center shadow-glow-emerald">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="font-display text-3xl text-emerald-glow text-glow">
                  {(user.displayName ?? user.uid).charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-ink-100 border border-emerald-glow/50 grid place-items-center text-emerald-glow hover:bg-emerald-glow/20 transition"
              aria-label={t.profile.changeAvatar}
              title={t.profile.changeAvatar}
            >
              <Camera size={14} />
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={() => setAvatarUrl(null)}
                className="absolute -top-1 -right-1 h-7 w-7 rounded-full bg-ink-100 border border-warning/50 grid place-items-center text-warning hover:bg-warning/20 transition"
                aria-label={t.profile.removeAvatar}
                title={t.profile.removeAvatar}
              >
                <X size={12} />
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pickAvatar(f);
                if (e.currentTarget) e.currentTarget.value = "";
              }}
            />
          </div>

          {/* Static identity */}
          <div className="flex-1 min-w-0 space-y-3 w-full">
            <KV
              label="UID"
              value={user.uid}
              icon={<Hash size={11} />}
              mono
              accent
            />
            <KV
              label={t.profile.phoneLabel}
              value={user.phone}
              icon={<Phone size={11} />}
              mono
            />
            <KV
              label={t.profile.enrolledLabel}
              value={formatDate(user.createdAt)}
              icon={<Calendar size={11} />}
              mono
            />
            <KV
              label={t.profile.statusLabel}
              value={t.profile.statusActive}
              icon={<ShieldCheck size={11} />}
              accent
            />
          </div>
        </div>

        <div className="dotted-divider h-px w-full my-6" />

        {/* Editable fields */}
        <div className="space-y-4">
          <Field
            label={t.profile.displayNameLabel}
            hint={t.profile.displayNameHint}
          >
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
              placeholder={t.profile.displayNamePlaceholder}
              className="field"
            />
          </Field>

          <Field label={t.profile.bioLabel} hint={`${bio.length}/280`}>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 280))}
              placeholder={t.profile.bioPlaceholder}
              className="field resize-none"
            />
          </Field>

          {error && (
            <div className="text-warning text-xs font-mono uppercase tracking-wider">
              ▸ {error}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="btn-primary h-10 px-5"
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {busy ? t.common.saving : t.common.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="label-mono">{label}</span>
        {hint && (
          <span className="font-mono text-[10px] text-white/30">{hint}</span>
        )}
      </div>
      {children}
    </label>
  );
}

function KV({
  label,
  value,
  icon,
  mono,
  accent,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="label-mono w-24 shrink-0 flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span
        className={
          (mono ? "font-mono " : "") +
          (accent ? "text-emerald-glow text-glow" : "text-white/85") +
          " text-sm truncate"
        }
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Reads the file, draws it into a square canvas of `size` and returns a
 * compressed JPEG data URL. Avatars rarely need more than 256px.
 */
async function downscaleToDataUrl(file: File, size: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas ctx");
    // cover-fit
    const ratio = Math.max(size / img.width, size / img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;
    const x = (size - w) / 2;
    const y = (size - h) / 2;
    ctx.fillStyle = "#0a0d12";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, x, y, w, h);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
