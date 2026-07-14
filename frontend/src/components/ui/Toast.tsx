"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCheckCircle,
  IconInfo,
  IconX,
} from "@/components/ui/icons";

export type ToastSeverity = "success" | "info" | "warning" | "error";

interface ToastItem {
  id: number;
  severity: ToastSeverity;
  message: string;
}

interface ToastApi {
  show: (severity: ToastSeverity, message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const AUTO_DISMISS_MS = 4500;

/** Tinted alert styles per severity — MUI-Alert-like on the dark stage. */
const STYLES: Record<
  ToastSeverity,
  { box: string; icon: string; Icon: React.ComponentType<{ size?: number }> }
> = {
  success: {
    box: "border-emerald-400/25 bg-[#10291d] text-emerald-50",
    icon: "text-emerald-400",
    Icon: IconCheckCircle,
  },
  info: {
    box: "border-sky-400/25 bg-[#122438] text-sky-50",
    icon: "text-sky-400",
    Icon: IconInfo,
  },
  warning: {
    box: "border-amber-400/25 bg-[#332512] text-amber-50",
    icon: "text-amber-400",
    Icon: IconAlertTriangle,
  },
  error: {
    box: "border-red-400/25 bg-[#331519] text-red-50",
    icon: "text-red-400",
    Icon: IconAlertCircle,
  },
};

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used within <ToastProvider>");
  return api;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (severity: ToastSeverity, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, severity, message }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
      );
    },
    [dismiss],
  );

  // Pending timers must not fire after the provider unmounts.
  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((timer) => clearTimeout(timer));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m) => show("success", m),
      info: (m) => show("info", m),
      warning: (m) => show("warning", m),
      error: (m) => show("error", m),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-20 right-4 z-[110] flex w-[min(92vw,24rem)] flex-col gap-2 md:bottom-5 md:right-5"
      >
        {toasts.map((toast) => {
          const style = STYLES[toast.severity];
          const Icon = style.Icon;
          return (
            <div
              key={toast.id}
              role={toast.severity === "error" ? "alert" : "status"}
              className={`toast-enter pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-pop backdrop-blur-sm ${style.box}`}
            >
              <span className={`mt-px shrink-0 ${style.icon}`} aria-hidden>
                <Icon size={19} />
              </span>
              <p className="min-w-0 flex-1 text-sm font-medium leading-snug">
                {toast.message}
              </p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Мэдэгдэл хаах"
                className="shrink-0 rounded-md p-1 opacity-60 transition hover:bg-white/10 hover:opacity-100"
              >
                <IconX size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
