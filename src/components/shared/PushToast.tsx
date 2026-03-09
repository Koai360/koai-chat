import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface ToastData {
  title: string;
  body: string;
  id: number;
}

export function PushToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_RECEIVED") {
        const id = Date.now();
        setToasts((prev) => [...prev, { title: event.data.title, body: event.data.body, id }]);
        setTimeout(() => dismiss(id), 5000);
      }
    };

    navigator.serviceWorker?.addEventListener("message", handler);
    return () => navigator.serviceWorker?.removeEventListener("message", handler);
  }, [dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-2 left-2 right-2 z-[100] flex flex-col gap-2 safe-top pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ y: -40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            onClick={() => dismiss(toast.id)}
            className="pointer-events-auto bg-bg-elevated/95 backdrop-blur-xl border border-border-subtle rounded-2xl px-4 py-3 shadow-2xl cursor-pointer flex items-start gap-3"
          >
            <img src="/icons/koai-192.png" alt="" className="w-10 h-10 rounded-xl shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-text text-sm font-semibold">{toast.title}</p>
              <p className="text-text-muted text-xs leading-snug line-clamp-2 mt-0.5">{toast.body}</p>
            </div>
            <X className="h-3.5 w-3.5 text-text-muted shrink-0 mt-0.5" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
