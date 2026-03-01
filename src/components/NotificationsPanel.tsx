import type { Notification } from "../lib/api";

interface Props {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days}d`;
  return new Date(dateStr).toLocaleDateString("es", { day: "numeric", month: "short" });
}

export function NotificationsPanel({ notifications, onMarkRead, onMarkAllRead, onClose }: Props) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0a0a0c]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/10">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Notificaciones</h2>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-xs text-[#572c77] dark:text-[#bcd431] font-medium px-2 py-1 rounded-lg active:bg-[#572c77]/10 transition-colors"
            >
              Leer todas
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-400 active:bg-gray-100 dark:active:bg-white/10"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 dark:text-gray-600 mb-3">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <p className="text-sm text-gray-400 dark:text-gray-500">Sin notificaciones</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <button
              key={notif.id}
              onClick={() => {
                if (!notif.read) onMarkRead(notif.id);
              }}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-white/5 transition-colors active:bg-gray-50 dark:active:bg-white/5 ${
                !notif.read ? "bg-[#572c77]/5 dark:bg-[#572c77]/10" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Unread dot */}
                <div className="flex-shrink-0 mt-1.5">
                  {!notif.read ? (
                    <span className="block w-2.5 h-2.5 rounded-full bg-[#572c77] dark:bg-[#bcd431]" />
                  ) : (
                    <span className="block w-2.5 h-2.5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-medium truncate ${!notif.read ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}>
                      {notif.title}
                    </span>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                      {timeAgo(notif.created_at)}
                    </span>
                  </div>
                  <p className={`text-[13px] mt-0.5 line-clamp-2 ${!notif.read ? "text-gray-700 dark:text-gray-300" : "text-gray-400 dark:text-gray-500"}`}>
                    {notif.body || notif.message}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
