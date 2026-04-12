import { useState, useEffect } from "react";
import type { KronosBrief } from "@/lib/api";
import { fetchBriefs } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { motion } from "framer-motion";
import { FileText, X, ChevronDown, AlertCircle } from "lucide-react";

interface Props {
  onClose: () => void;
}

type FilterTab = "all" | "pending" | "completed";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-400 border-red-500/20",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  normal: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  low: "bg-bg-surface text-text-muted border-border-subtle",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  completed: "bg-noa/15 text-noa border-noa/20",
  failed: "bg-red-500/15 text-red-400 border-red-500/20",
};

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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle safe-top">
        <h2 className="text-base font-semibold text-text">Briefs</h2>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-text-muted" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-border-subtle">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            variant={filter === tab.key ? "default" : "ghost"}
            size="sm"
            className="h-7 text-[11px] px-3"
            onClick={() => setFilter(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="px-4 py-4 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 px-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive/50 mb-2" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : briefs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 px-8 text-center">
            <FileText className="h-10 w-10 text-text-muted/30 mb-3" />
            <p className="text-sm text-text-muted">Sin briefs</p>
          </div>
        ) : (
          briefs.map((brief, i) => (
            <motion.div
              key={brief.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Collapsible
                open={expandedId === brief.id}
                onOpenChange={() => setExpandedId(expandedId === brief.id ? null : brief.id)}
              >
                <CollapsibleTrigger className="w-full text-left px-4 py-3 border-b border-border-subtle hover:bg-bg-surface active:bg-bg-surface transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-text truncate flex-1">
                      {brief.title}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-text-muted">{timeAgo(brief.created_at)}</span>
                      <ChevronDown className={`h-3.5 w-3.5 text-text-muted transition-transform ${expandedId === brief.id ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${PRIORITY_COLORS[brief.priority] || PRIORITY_COLORS.normal}`}>
                      {brief.priority}
                    </Badge>
                    <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${STATUS_COLORS[brief.status] || STATUS_COLORS.pending}`}>
                      {brief.status.replace("_", " ")}
                    </Badge>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 py-3 bg-bg-surface/50 border-b border-border-subtle">
                    <p className="text-xs text-text/80 whitespace-pre-wrap leading-relaxed">
                      {brief.summary}
                    </p>
                    {brief.notes && (
                      <p className="text-[11px] text-text-muted mt-2 italic">
                        Notas: {brief.notes}
                      </p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </motion.div>
          ))
        )}
      </ScrollArea>
    </div>
  );
}
