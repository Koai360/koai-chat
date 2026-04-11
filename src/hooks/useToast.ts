import { createContext, useContext, useCallback, useState, useRef } from "react";

/**
 * Minimal toast system — sin Radix para bundle light.
 * Uso:
 *   const toast = useToast();
 *   toast.show({ title: "Guardado", description: "...", action: { label: "Deshacer", onClick: () => {} } });
 */

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  id?: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "danger";
  action?: ToastAction;
  duration?: number; // ms. Default 4000. Use 0 for no auto-dismiss.
}

export interface ToastItem extends ToastOptions {
  id: string;
  createdAt: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  show: (opts: ToastOptions) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback no-op cuando no hay provider — no rompe tests/storybook
    return {
      toasts: [],
      show: () => "",
      dismiss: () => {},
      clear: () => {},
    };
  }
  return ctx;
}

export function useToastState() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (opts: ToastOptions): string => {
      const id = opts.id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const item: ToastItem = {
        ...opts,
        id,
        createdAt: Date.now(),
      };
      setToasts((prev) => {
        // Max 3 toasts — kick out oldest
        const next = [...prev, item];
        return next.slice(-3);
      });
      const duration = opts.duration ?? 4000;
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timersRef.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  const clear = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  return { toasts, show, dismiss, clear };
}
