"use client";
import { AnimatePresence, motion } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";
interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}

interface Ctx {
  push: (t: Omit<Toast, "id">) => void;
}

const ToastCtx = createContext<Ctx | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setItems((arr) => [...arr, { id, ...t }]);
    setTimeout(() => {
      setItems((arr) => arr.filter((x) => x.id !== id));
    }, 4500);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-[200] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 20, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.96 }}
              className="pointer-events-auto surface-strong p-3.5 flex gap-3 items-start"
            >
              <Icon type={t.type} />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">{t.title}</div>
                {t.message && (
                  <div className="text-xs text-white/60 mt-0.5">{t.message}</div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

function Icon({ type }: { type: ToastType }) {
  const cls = "shrink-0 mt-0.5";
  if (type === "success")
    return <CheckCircle2 size={18} className={`${cls} text-emerald-glow`} />;
  if (type === "error")
    return <XCircle size={18} className={`${cls} text-warning`} />;
  if (type === "warning")
    return <AlertTriangle size={18} className={`${cls} text-amber-glow`} />;
  return <Info size={18} className={`${cls} text-emerald-glow`} />;
}
