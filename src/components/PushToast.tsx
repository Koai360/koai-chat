import { useState, useEffect, useCallback } from "react";

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
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => dismiss(toast.id)}
          className="pointer-events-auto bg-[#1c1c1e]/95 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3 shadow-2xl animate-bubble-in cursor-pointer flex items-start gap-3"
        >
          <img src="/icons/koai-192.png" alt="" className="w-10 h-10 rounded-xl flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-semibold">{toast.title}</p>
            <p className="text-gray-400 text-xs leading-snug line-clamp-2 mt-0.5">{toast.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
