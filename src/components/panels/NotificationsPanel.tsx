import { useState, useCallback, useRef } from "react";
import type { Notification } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, Trash2, CheckCheck } from "lucide-react";

interface Props {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onClose: () => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("es", { day: "numeric", month: "short" });
}

export function NotificationsPanel({ notifications, onMarkRead, onMarkAllRead, onDelete, onDeleteAll, onClose }: Props) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Swipe-to-delete
  const swipingRef = useRef<{ id: string; startX: number; currentX: number } | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [swipedId, setSwipedId] = useState<string | null>(null);

  const handleTouchStart = useCallback((id: string, e: React.TouchEvent) => {
    if (swipedId && swipedId !== id) {
      const prev = itemRefs.current.get(swipedId);
      if (prev) { prev.style.transition = "transform 0.15s"; prev.style.transform = ""; }
      setSwipedId(null);
    }
    swipingRef.current = { id, startX: e.touches[0].clientX, currentX: 0 };
  }, [swipedId]);

  const handleTouchMove = useCallback((id: string, e: React.TouchEvent) => {
    if (!swipingRef.current || swipingRef.current.id !== id) return;
    const diff = swipingRef.current.startX - e.touches[0].clientX;
    if (diff > 0) {
      swipingRef.current.currentX = diff;
      const el = itemRefs.current.get(id);
      if (el) el.style.transform = `translateX(-${Math.min(diff, 80)}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback((id: string) => {
    if (!swipingRef.current || swipingRef.current.id !== id) return;
    const el = itemRefs.current.get(id);
    if (swipingRef.current.currentX > 60) {
      if (el) { el.style.transition = "transform 0.15s"; el.style.transform = "translateX(-80px)"; }
      setSwipedId(id);
    } else {
      if (el) { el.style.transition = "transform 0.15s"; el.style.transform = ""; }
    }
    swipingRef.current = null;
  }, []);

  const handleSwipeDelete = useCallback((id: string) => {
    const el = itemRefs.current.get(id);
    if (el) {
      el.style.transition = "transform 0.2s, opacity 0.2s";
      el.style.transform = "translateX(-100%)";
      el.style.opacity = "0";
    }
    setTimeout(() => { onDelete(id); setSwipedId(null); }, 200);
  }, [onDelete]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle safe-top">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-text">Notificaciones</h2>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="h-5 text-[10px] px-1.5">
              {unreadCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-[11px] text-noa" onClick={onMarkAllRead}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Leer todas
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-[11px] text-destructive" onClick={onDeleteAll}>
              Borrar todas
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-text-muted" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-8">
            <Bell className="h-12 w-12 text-text-muted/30 mb-3" />
            <p className="text-sm text-text-muted">Sin notificaciones</p>
          </div>
        ) : (
          <AnimatePresence>
            {notifications.map((notif) => (
              <motion.div
                key={notif.id}
                layout
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
                className="relative overflow-hidden"
              >
                {/* Delete background */}
                <div className="absolute inset-y-0 right-0 w-20 bg-destructive flex items-center justify-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSwipeDelete(notif.id); }}
                    className="w-full h-full flex items-center justify-center"
                  >
                    <Trash2 className="h-4 w-4 text-white" />
                  </button>
                </div>

                {/* Item */}
                <div
                  ref={(el) => {
                    if (el) itemRefs.current.set(notif.id, el);
                    else itemRefs.current.delete(notif.id);
                  }}
                  onTouchStart={(e) => handleTouchStart(notif.id, e)}
                  onTouchMove={(e) => handleTouchMove(notif.id, e)}
                  onTouchEnd={() => handleTouchEnd(notif.id)}
                  onClick={() => {
                    if (swipedId === notif.id) { setSwipedId(null); return; }
                    if (!notif.read) onMarkRead(notif.id);
                  }}
                  className={`relative px-4 py-3 border-b border-border-subtle transition-colors active:bg-bg-surface bg-bg-sidebar cursor-pointer ${
                    !notif.read ? "bg-brand/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-1.5">
                      {!notif.read ? (
                        <span className="block w-2 h-2 rounded-full bg-noa" />
                      ) : (
                        <span className="block w-2 h-2" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${!notif.read ? "text-text font-medium" : "text-text-muted"}`}>
                          {notif.title}
                        </span>
                        <span className="text-[10px] text-text-muted shrink-0">
                          {timeAgo(notif.created_at)}
                        </span>
                      </div>
                      <p className={`text-xs mt-0.5 line-clamp-2 ${!notif.read ? "text-text/80" : "text-text-muted"}`}>
                        {notif.body || notif.message}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </ScrollArea>
    </div>
  );
}
