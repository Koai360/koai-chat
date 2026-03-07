import { useState, useEffect } from "react";
import type { KronosBrief } from "../lib/api";
import { fetchBriefs } from "../lib/api";

interface Props {
  onClose: () => void;
}

type FilterTab = "all" | "pending" | "completed";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500/20 text-red-400",
  high: "bg-orange-500/20 text-orange-400",
  normal: "bg-blue-500/20 text-blue-400",
  low: "bg-white/10 text-[#9b9b9b]",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  in_progress: "bg-blue-500/20 text-blue-400",
  completed: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
};

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

export function BriefsPanel({ onClose }: Props) {
  const [briefs, setBriefs] = useState<KronosBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    const statusParam = filter === "all" ? undefined : filter;
    fetchBriefs(statusParam)
      .then(setBriefs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filter]);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "pending", label: "Pendientes" },
    { key: "completed", label: "Completados" },
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0a0a0c]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/10 safe-top">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Briefs</h2>
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

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-gray-100 dark:border-white/5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filter === tab.key
                ? "bg-[#572c77] text-white"
                : "text-gray-500 dark:text-gray-400 active:bg-gray-100 dark:active:bg-white/10"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-[#572c77] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 px-8 text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : briefs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 px-8 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-500">Sin briefs</p>
          </div>
        ) : (
          briefs.map((brief) => (
            <button
              key={brief.id}
              onClick={() => setExpandedId(expandedId === brief.id ? null : brief.id)}
              className="w-full text-left px-4 py-3 border-b border-gray-100 dark:border-white/5 active:bg-gray-50 dark:active:bg-white/5 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate flex-1">
                  {brief.title}
                </span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                  {timeAgo(brief.created_at)}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-1.5">
                {/* Priority badge */}
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLORS[brief.priority] || PRIORITY_COLORS.normal}`}>
                  {brief.priority}
                </span>
                {/* Status chip */}
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[brief.status] || STATUS_COLORS.pending}`}>
                  {brief.status.replace("_", " ")}
                </span>
              </div>

              {/* Expanded summary */}
              {expandedId === brief.id && (
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-white/5">
                  <p className="text-[13px] text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                    {brief.summary}
                  </p>
                  {brief.notes && (
                    <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-2 italic">
                      Notas: {brief.notes}
                    </p>
                  )}
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
