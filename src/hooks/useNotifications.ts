import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
  type Notification,
} from "../lib/api";

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchNotifications();
      setNotifications(data);
    } catch (err) {
      console.error("[Notifications] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount + poll every 30s
  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    markNotificationRead(id).catch(() => {});
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    markAllNotificationsRead().catch(() => {});
  }, []);

  const removeOne = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    deleteNotification(id).catch(() => {});
  }, []);

  const removeAll = useCallback(async () => {
    setNotifications([]);
    deleteAllNotifications().catch(() => {});
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, loading, unreadCount, markRead, markAllRead, removeOne, removeAll, refresh: load };
}
