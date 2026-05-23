"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Folder,
  FilePlus,
  Search,
  ChevronDown,
  KeyRound,
  LogOut,
  X,
  ShieldCheck,
  Newspaper,
  Headphones,
  MessageSquare,
  ScrollText,
  UserCircle,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { StatusBar } from "@/components/ui/StatusBar";
import { CinematicBackground } from "@/components/ui/CinematicBackground";
import { BootSequence } from "@/components/ui/BootSequence";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useChatStream } from "@/hooks/useChatStream";
import { cn } from "@/lib/utils";
import type { Dossier } from "@/lib/dossier";
import type { DashboardSection, SessionUserDto } from "./types";
import { DatabaseSection } from "./sections/DatabaseSection";
import { AddSection } from "./sections/AddSection";
import { FindFriendsSection } from "./sections/FindFriendsSection";
import { NewsSection } from "./sections/NewsSection";
import { SupportSection } from "./sections/SupportSection";
import { ChatSection } from "./sections/ChatSection";
import { ProfileSection } from "./sections/ProfileSection";
import { ActivitySection } from "./sections/ActivitySection";
import { ChangePasswordModal } from "./modals/ChangePasswordModal";
import { DossierViewModal } from "./modals/DossierViewModal";
import { ChatFab } from "./ChatFab";

interface Props {
  user: SessionUserDto;
  initialDossiers: Dossier[];
}

export function DashboardClient({ user, initialDossiers }: Props) {
  return (
    <ToastProvider>
      <DashboardInner user={user} initialDossiers={initialDossiers} />
    </ToastProvider>
  );
}

function DashboardInner({ user, initialDossiers }: Props) {
  const [booted, setBooted] = useState(false);
  const [section, setSection] = useState<DashboardSection>("database");
  const [dossiers, setDossiers] = useState<Dossier[]>(initialDossiers);
  const [currentUser, setCurrentUser] = useState<SessionUserDto>(user);
  const [editingDossier, setEditingDossier] = useState<Dossier | null>(null);
  const [viewingDossier, setViewingDossier] = useState<Dossier | null>(null);
  const [showChangePw, setShowChangePw] = useState(false);
  const [startChatPeerId, setStartChatPeerId] = useState<string | null>(null);
  const [chatUnread, setChatUnread] = useState(0);

  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();

  const refreshDossiers = useCallback(async () => {
    const res = await fetch("/api/dossiers");
    if (res.ok) {
      const data = await res.json();
      setDossiers(data.dossiers);
    }
  }, []);

  // Poll unread chat count so the navbar badge stays current even when the
  // user is on a different tab. The interval is intentionally lazy because
  // the SSE stream below also bumps unread for instant updates.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function pull() {
      try {
        const res = await fetch("/api/chat/conversations");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setChatUnread(data.unread ?? 0);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) timer = setTimeout(pull, 60_000);
      }
    }
    pull();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Real-time bump: when a fresh message arrives on the SSE stream and the
  // user isn't currently looking at the chat tab, bump the unread badge.
  useChatStream({
    onMessage: (msg) => {
      if (msg.recipientId !== currentUser.id) return; // only inbound matters
      // If the chat section is open, ChatSection itself will mark it read.
      // We optimistically increment otherwise.
      setChatUnread((n) => n + 1);
    },
  });

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      <CinematicBackground variant="app" />
      {!booted && <BootSequence onDone={() => setBooted(true)} />}

      <TopBar
        user={currentUser}
        section={section}
        onChangeSection={setSection}
        onChangePassword={() => setShowChangePw(true)}
        onLogout={logout}
        onOpenProfile={() => setSection("profile")}
        onOpenActivity={() => setSection("activity")}
        chatUnread={chatUnread}
      />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-12 pt-2">
        <AnimatePresence mode="wait">
          {section === "database" && (
            <motion.div
              key="database"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <DatabaseSection
                dossiers={dossiers}
                onOpen={(d) => setViewingDossier(d)}
                onEdit={(d) => {
                  setEditingDossier(d);
                  setSection("add");
                }}
                onCreate={() => {
                  setEditingDossier(null);
                  setSection("add");
                }}
                onDelete={async (id) => {
                  const res = await fetch(`/api/dossiers/${id}`, {
                    method: "DELETE",
                  });
                  if (res.ok) {
                    setDossiers((arr) => arr.filter((d) => d.id !== id));
                    toast.push({
                      type: "success",
                      title: t.database.purged,
                      message: t.database.purgedDesc,
                    });
                  } else {
                    toast.push({ type: "error", title: t.database.cantDelete });
                  }
                }}
              />
            </motion.div>
          )}

          {section === "add" && (
            <motion.div
              key="add"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <AddSection
                user={currentUser}
                editing={editingDossier}
                onCancel={() => {
                  setEditingDossier(null);
                  setSection("database");
                }}
                onSaved={async (saved) => {
                  await refreshDossiers();
                  setEditingDossier(null);
                  setSection("database");
                  toast.push({
                    type: "success",
                    title: editingDossier ? t.add.updatedToast : t.add.saved,
                    message: `${t.add.savedRef} ${saved.id.slice(-8).toUpperCase()}`,
                  });
                }}
              />
            </motion.div>
          )}

          {section === "find" && (
            <motion.div
              key="find"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <FindFriendsSection
                currentUid={currentUser.uid}
                onMessageOperative={(id) => {
                  setStartChatPeerId(id);
                  setSection("chat");
                }}
              />
            </motion.div>
          )}

          {section === "chat" && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <ChatSection
                user={currentUser}
                dossiers={dossiers}
                openPeerId={startChatPeerId}
                onConsumed={() => setStartChatPeerId(null)}
                onUnreadChange={setChatUnread}
              />
            </motion.div>
          )}

          {section === "news" && (
            <motion.div
              key="news"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <NewsSection />
            </motion.div>
          )}

          {section === "support" && (
            <motion.div
              key="support"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <SupportSection />
            </motion.div>
          )}

          {section === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <ProfileSection
                user={currentUser}
                onUpdated={(next) => setCurrentUser(next)}
              />
            </motion.div>
          )}

          {section === "activity" && (
            <motion.div
              key="activity"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <ActivitySection />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <FooterBar />

      <ChatFab
        active={section === "chat"}
        unread={chatUnread}
        onClick={() => setSection("chat")}
      />

      <AnimatePresence>
        {showChangePw && (
          <ChangePasswordModal onClose={() => setShowChangePw(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {viewingDossier && (
          <DossierViewModal
            user={currentUser}
            dossier={viewingDossier}
            onClose={() => setViewingDossier(null)}
            onEdit={() => {
              setEditingDossier(viewingDossier);
              setViewingDossier(null);
              setSection("add");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TopBar({
  user,
  section,
  onChangeSection,
  onChangePassword,
  onLogout,
  onOpenProfile,
  onOpenActivity,
  chatUnread,
}: {
  user: SessionUserDto;
  section: DashboardSection;
  onChangeSection: (s: DashboardSection) => void;
  onChangePassword: () => void;
  onLogout: () => void;
  onOpenProfile: () => void;
  onOpenActivity: () => void;
  chatUnread: number;
}) {
  const { t } = useI18n();
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.("[data-profile-menu]")) setProfileOpen(false);
    }
    if (profileOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [profileOpen]);

  const tabs: {
    id: DashboardSection;
    label: string;
    icon: React.ReactNode;
    accent?: boolean;
    badge?: number;
  }[] = [
    { id: "database", label: t.nav.database, icon: <Folder size={14} /> },
    { id: "add", label: t.nav.add, icon: <FilePlus size={14} /> },
    { id: "find", label: t.nav.find, icon: <Search size={14} /> },
    {
      id: "chat",
      label: t.nav.chat,
      icon: <MessageSquare size={14} />,
      accent: true,
      badge: chatUnread,
    },
    { id: "news", label: t.nav.news, icon: <Newspaper size={14} /> },
    { id: "support", label: t.nav.support, icon: <Headphones size={14} /> },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-50/85 backdrop-blur-xl">
      {/* Row 1: brand + profile + lang */}
      <div className="px-4 sm:px-6 lg:px-8 pt-3 pb-2 flex items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Logo size={28} />
          <div className="hidden sm:block min-w-0">
            <div className="font-display tracking-[0.3em] text-emerald-glow text-glow text-[13px] leading-none">
              AEGIS
            </div>
            <div className="label-mono mt-0.5 truncate">
              OPERATIONS // CONSOLE
            </div>
          </div>
        </div>

        <div className="hidden xl:block ml-4 flex-1 min-w-0">
          <StatusBar />
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />

          <div className="relative" data-profile-menu>
            <button
              onClick={() => setProfileOpen((s) => !s)}
              className="flex items-center gap-2 sm:gap-3 h-10 px-2 sm:px-3 rounded-md border border-white/10 hover:bg-white/[0.04]"
            >
              <Avatar
                uid={user.uid}
                name={user.displayName}
                url={user.avatarUrl}
              />
              <div className="hidden md:flex flex-col leading-tight text-left">
                <span className="text-[12px] text-white">
                  {user.displayName ?? t.profile.operative}
                </span>
                <span className="font-mono text-[10px] text-white/40">
                  UID {user.uid}
                </span>
              </div>
              <ChevronDown size={14} className="text-white/50" />
            </button>

            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-64 surface-strong p-2 z-50"
                >
                  <div className="px-2 py-2 mb-1">
                    <div className="text-sm text-white">
                      {user.displayName ?? t.profile.operative}
                    </div>
                    <div className="font-mono text-[11px] text-white/50">
                      UID {user.uid}
                    </div>
                    <div className="font-mono text-[10px] text-white/35 mt-1">
                      {user.phone}
                    </div>
                  </div>
                  <div className="h-px bg-white/[0.06] my-1" />
                  <MenuItem
                    icon={<UserCircle size={14} />}
                    onClick={() => {
                      setProfileOpen(false);
                      onOpenProfile();
                    }}
                  >
                    {t.profile.profile}
                  </MenuItem>
                  <MenuItem
                    icon={<ScrollText size={14} />}
                    onClick={() => {
                      setProfileOpen(false);
                      onOpenActivity();
                    }}
                  >
                    {t.profile.activity}
                  </MenuItem>
                  <MenuItem
                    icon={<KeyRound size={14} />}
                    onClick={() => {
                      setProfileOpen(false);
                      onChangePassword();
                    }}
                  >
                    {t.profile.changePassword}
                  </MenuItem>
                  <MenuItem
                    icon={<LogOut size={14} className="text-warning" />}
                    onClick={() => {
                      setProfileOpen(false);
                      onLogout();
                    }}
                    danger
                  >
                    {t.profile.logout}
                  </MenuItem>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Row 2: tabs */}
      <nav className="px-2 sm:px-4 lg:px-6 pb-2 flex items-center gap-1 sm:gap-1.5 overflow-x-auto scroll-smooth">
        {tabs.map((tab) => {
          const active = section === tab.id;
          const showBadge = tab.badge && tab.badge > 0;
          const isAccent = !!tab.accent;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeSection(tab.id)}
              className={cn(
                "relative flex items-center gap-2 px-3 sm:px-4 h-9 rounded-md text-[12px] sm:text-[13px] font-medium uppercase tracking-[0.14em] transition whitespace-nowrap shrink-0",
                active
                  ? "text-emerald-glow"
                  : isAccent
                    ? "text-emerald-glow/90 hover:text-emerald-glow"
                    : "text-white/55 hover:text-white",
              )}
            >
              {/* Glowing background for the AntChat tab so it never blends with the others */}
              {isAccent && !active && (
                <span
                  aria-hidden
                  className="absolute inset-0 -z-10 rounded-md border border-emerald-glow/30 bg-emerald-glow/[0.04]"
                />
              )}

              {tab.icon}
              <span>{tab.label}</span>

              {/* "live" indicator on the AntChat tab when it's not the active one */}
              {isAccent && !active && (
                <span className="hidden sm:inline-flex items-center gap-1 ml-1 font-mono text-[9px] tracking-[0.22em] text-emerald-glow">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-glow animate-pulseDot" />
                  LIVE
                </span>
              )}

              {/* unread bubble */}
              {showBadge && (
                <span
                  className={cn(
                    "ml-1 inline-flex h-[18px] min-w-[18px] px-1.5 items-center justify-center rounded-full font-mono text-[10px] leading-none font-bold",
                    "bg-emerald-glow text-ink-50 shadow-[0_0_10px_rgba(16,245,168,0.6)]",
                  )}
                >
                  {tab.badge! > 99 ? "99+" : tab.badge}
                </span>
              )}

              {active && (
                <motion.span
                  layoutId="tab-active"
                  className="absolute inset-0 -z-10 rounded-md border border-emerald-glow/40 bg-emerald-glow/[0.07] shadow-glow-emerald"
                />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

function MenuItem({
  icon,
  onClick,
  children,
  danger,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-[13px] transition",
        danger
          ? "text-warning hover:bg-warning/10"
          : "text-white/85 hover:bg-white/[0.05] hover:text-white",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function Avatar({
  uid,
  name,
  url,
}: {
  uid: string;
  name: string | null;
  url: string | null;
}) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={name ?? uid}
        className="h-7 w-7 rounded-md object-cover border border-white/10"
      />
    );
  }
  const seed = name ?? uid;
  const letter = seed.replace(/[^A-Za-z0-9]/g, "").charAt(0)?.toUpperCase() || "A";
  return (
    <div className="h-7 w-7 rounded-md grid place-items-center bg-emerald-glow/15 border border-emerald-glow/40 text-emerald-glow font-mono text-[12px]">
      {letter}
    </div>
  );
}

function FooterBar() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-white/[0.06] bg-ink-50/70 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">
      <span className="flex items-center gap-2">
        <ShieldCheck size={12} className="text-emerald-glow" />
        {t.auth.secureSession}
      </span>
      <span>v1.0.0</span>
    </footer>
  );
}
