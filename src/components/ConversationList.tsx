import type { Conversation } from "../hooks/useChat";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function ConversationList({ conversations, activeId, onSelect, onNew, onDelete, onClose }: Props) {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 safe-top">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Conversaciones</h2>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700"
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
        className="mx-4 mt-3 mb-2 py-2.5 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
      >
        + Nueva conversación
      </button>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2">
        {conversations.length === 0 ? (
          <p className="text-center text-sm text-gray-400 mt-8">Sin conversaciones</p>
        ) : (
          conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => { onSelect(c.id); onClose(); }}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl mb-1 cursor-pointer transition-colors ${
                c.id === activeId
                  ? "bg-indigo-50 dark:bg-indigo-950/30"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      c.agent === "kira" ? "bg-pink-400" : "bg-indigo-400"
                    }`}
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {c.title}
                  </span>
                </div>
                <span className="text-xs text-gray-400 ml-4">
                  {new Date(c.createdAt).toLocaleDateString()}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c.id);
                }}
                className="ml-2 w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
