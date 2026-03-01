import { useState, useRef } from "react";
import type { Conversation } from "../hooks/useChat";
import type { AuthUser } from "../hooks/useAuth";
import { relativeTime } from "../lib/time";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  user: AuthUser;
  onLogout: () => void;
}

function haptic(ms = 8) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

export function ConversationList({ conversations, activeId, onSelect, onNew, onDelete, onClose, user, onLogout }: Props) {
  const [search, setSearch] = useState("");
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const touchStartX = useRef(0);

  const filtered = search.trim()
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent, id: string) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 80) {
      setSwipedId(id);
    } else if (diff < -40) {
      setSwipedId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0a0a0c]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 safe-top">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Conversaciones</h2>
        <button
          onClick={onClose}
          className="w-11 h-11 flex items-center justify-center text-gray-500 hover:text-gray-700 rounded-xl"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* New conversation button */}
      <button
        onClick={() => { onNew(); onClose(); }}
        className="mx-4 mt-3 mb-2 py-2.5 rounded-xl border-2 border-dashed border-[#572c77]/30 dark:border-[#572c77]/40 text-sm font-medium text-[#572c77] dark:text-[#bcd431] hover:border-[#572c77]/60 transition-colors"
      >
        + Nueva conversación
      </button>

      {/* Search */}
      <div className="px-4 mb-2">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1a1a1e] pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#572c77]"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-gray-400 mt-8">
            {search ? "Sin resultados" : "Sin conversaciones"}
          </p>
        ) : (
          filtered.map((c) => (
            <div
              key={c.id}
              className="relative overflow-hidden rounded-xl mb-1"
              onTouchStart={handleTouchStart}
              onTouchEnd={(e) => handleTouchEnd(e, c.id)}
            >
              {/* Delete button (revealed on swipe) */}
              <div className={`absolute right-0 top-0 bottom-0 flex items-center transition-all ${swipedId === c.id ? "w-16" : "w-0"} overflow-hidden`}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    haptic(15);
                    onDelete(c.id);
                    setSwipedId(null);
                  }}
                  className="w-full h-full bg-red-500 flex items-center justify-center text-white"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>

              {/* Conversation item */}
              <div
                onClick={() => { haptic(); onSelect(c.id); onClose(); setSwipedId(null); }}
                className={`flex items-center justify-between px-3 py-2.5 cursor-pointer transition-all ${
                  swipedId === c.id ? "-translate-x-16" : ""
                } ${
                  c.id === activeId
                    ? "bg-[#572c77]/10 dark:bg-[#572c77]/20"
                    : "hover:bg-gray-50 dark:hover:bg-[#1a1a1e]"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0 bg-[#bcd431]" />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {c.title}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 ml-4">
                    {relativeTime(c.createdAt)}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    haptic(15);
                    onDelete(c.id);
                  }}
                  className="ml-2 w-6 h-6 flex-shrink-0 items-center justify-center text-gray-300 hover:text-red-500 transition-colors hidden sm:flex"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* User footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between safe-bottom">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#572c77]/10 dark:bg-[#572c77]/30 flex items-center justify-center text-[#572c77] dark:text-[#bcd431] font-semibold text-sm">
            {user.name[0]}
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{user.name}</span>
        </div>
        <button
          onClick={onLogout}
          className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-xl"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
