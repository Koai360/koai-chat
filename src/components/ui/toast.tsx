import { useMemo, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, AlertTriangle, Info } from "lucide-react";
import { ToastContext, useToastState, type ToastItem } from "@/hooks/useToast";

export function ToastProvider({ children }: { children: ReactNode }) {
  const state = useToastState();
  const value = useMemo(
    () => ({
      toasts: state.toasts,
      show: state.show,
      dismiss: state.dismiss,
      clear: state.clear,
    }),
    [state.toasts, state.show, state.dismiss, state.clear],
  );
  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={state.toasts} onDismiss={state.dismiss} />
    </ToastContext.Provider>
  );
}

function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className="fixed inset-x-0 z-[200] flex flex-col items-center gap-2 px-4 pointer-events-none"
      style={{
        bottom: "calc(6.5rem + env(safe-area-inset-bottom, 0px))",
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const variant = toast.variant || "default";
  const { icon: Icon, iconColor, borderColor } = getVariantStyles(variant);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="pointer-events-auto max-w-[380px] w-[min(380px,calc(100vw-2rem))] rounded-2xl shadow-2xl overflow-hidden"
      style={{
        backgroundColor: "rgba(15, 15, 18, 0.95)",
        backdropFilter: "blur(16px)",
        border: `1px solid ${borderColor}`,
        boxShadow: "0 10px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05)",
      }}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        {Icon && (
          <div
            className="shrink-0 mt-0.5"
            style={{ color: iconColor }}
            aria-hidden
          >
            <Icon className="size-4" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-white leading-tight">{toast.title}</div>
          {toast.description && (
            <div className="text-[11px] text-white/60 mt-0.5 leading-snug">{toast.description}</div>
          )}
        </div>
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              onDismiss();
            }}
            className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors"
            style={{
              color: "#D4E94B",
              backgroundColor: "rgba(212, 233, 75, 0.1)",
            }}
          >
            {toast.action.label}
          </button>
        )}
        <button
          onClick={onDismiss}
          className="shrink-0 text-white/40 hover:text-white/80 transition-colors"
          aria-label="Cerrar notificación"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

function getVariantStyles(variant: "default" | "success" | "danger") {
  switch (variant) {
    case "success":
      return {
        icon: Check,
        iconColor: "#D4E94B",
        borderColor: "rgba(212, 233, 75, 0.25)",
      };
    case "danger":
      return {
        icon: AlertTriangle,
        iconColor: "#ef4444",
        borderColor: "rgba(239, 68, 68, 0.25)",
      };
    default:
      return {
        icon: Info,
        iconColor: "rgba(255,255,255,0.6)",
        borderColor: "rgba(255, 255, 255, 0.12)",
      };
  }
}
