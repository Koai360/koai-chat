import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Check,
  X,
  Loader2,
  Pencil,
  ToggleLeft,
  ToggleRight,
  GraduationCap,
  Database,
  Sparkles,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  fetchKiraLearnings,
  approveKiraLearning,
  rejectKiraLearning,
  editKiraLearning,
  fetchSalesExamples,
  fetchSalesMethodology,
  toggleKbActive,
  fetchKbStats,
  type KiraLearning,
  type SalesExample,
  type SalesMethodology,
  type KbStats,
} from "@/lib/api";

type Tab = "learnings" | "examples" | "methodology";

export function KbManagerPage() {
  const [tab, setTab] = useState<Tab>("learnings");
  const [stats, setStats] = useState<KbStats | null>(null);

  useEffect(() => {
    fetchKbStats().then(setStats).catch(() => setStats(null));
  }, [tab]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="size-5 text-noa" />
          <h1 className="text-lg font-display font-medium text-text">KB Manager</h1>
          {stats && (
            <span className="ml-auto text-xs text-text-subtle font-mono">
              {stats.examples_active}/{stats.examples_total} ejemplos ·{" "}
              {stats.methodology_total} metodol · {stats.learnings_pending} pending
            </span>
          )}
        </div>
        <p className="text-xs text-text-muted">
          Control center del conocimiento de Kira. Audita lecciones aprendidas,
          gestiona ejemplos de ventas reales y metodologías.
        </p>

        {/* Tabs */}
        <div className="flex gap-2 mt-3">
          <TabButton
            active={tab === "learnings"}
            onClick={() => setTab("learnings")}
            icon={<GraduationCap className="size-3" />}
            label="Lecciones"
            badge={stats?.learnings_pending}
          />
          <TabButton
            active={tab === "examples"}
            onClick={() => setTab("examples")}
            icon={<Sparkles className="size-3" />}
            label="Ejemplos"
          />
          <TabButton
            active={tab === "methodology"}
            onClick={() => setTab("methodology")}
            icon={<Database className="size-3" />}
            label="Metodologías"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === "learnings" && <LearningsTab />}
        {tab === "examples" && <ExamplesTab />}
        {tab === "methodology" && <MethodologyTab />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-1.5 transition-all ${
        active
          ? "bg-noa/15 border-noa/40 text-noa"
          : "bg-bg-surface border-border text-text-muted hover:bg-bg-hover"
      }`}
    >
      {icon}
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[9px] font-mono">
          {badge}
        </span>
      )}
    </button>
  );
}

// ─── LEARNINGS TAB ───

function LearningsTab() {
  const [data, setData] = useState<{ learnings: KiraLearning[]; counts: { pending: number; approved: number; rejected: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [busy, setBusy] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetchKiraLearnings(filter)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: number) => {
    setBusy(id);
    try {
      if (editingId === id && editText.trim()) {
        await editKiraLearning(id, editText.trim());
      }
      await approveKiraLearning(id);
      setData((prev) => prev ? { ...prev, learnings: prev.learnings.filter((l) => l.id !== id) } : prev);
      setEditingId(null);
    } finally { setBusy(null); }
  };

  const handleReject = async (id: number) => {
    setBusy(id);
    try {
      await rejectKiraLearning(id);
      setData((prev) => prev ? { ...prev, learnings: prev.learnings.filter((l) => l.id !== id) } : prev);
    } finally { setBusy(null); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 px-4 py-2 border-b border-border/60">
        {(["pending", "approved", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border transition ${
              filter === f
                ? "bg-noa/10 border-noa/30 text-noa"
                : "bg-transparent border-border text-text-muted hover:bg-bg-surface"
            }`}
          >
            {f} {data?.counts?.[f] !== undefined && `(${data.counts[f]})`}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-text-muted" />
          </div>
        ) : !data?.learnings.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-muted">
            <GraduationCap className="size-10 mb-3 opacity-30" />
            <p className="text-sm">No hay lecciones en "{filter}"</p>
            {filter === "pending" && (
              <p className="text-xs text-text-subtle mt-2 max-w-xs text-center">
                Cuando Kira aprende algo nuevo aparecerá aquí para que lo revises antes de inyectarlo al prompt.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2 px-3 py-3">
            <AnimatePresence mode="popLayout">
              {data.learnings.map((l) => {
                const isBusy = busy === l.id;
                const isEditing = editingId === l.id;
                return (
                  <motion.div
                    key={l.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="border border-border rounded-xl p-3 bg-bg-surface group"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border border-border text-text-muted">
                        {l.category}
                      </span>
                      <span className="ml-auto text-[10px] text-text-subtle font-mono">
                        {new Date(l.created_at).toLocaleDateString("es-ES", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    {isEditing ? (
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        autoFocus
                        className="w-full text-sm bg-bg-base border border-border rounded-lg px-3 py-2 resize-none outline-none focus:border-noa/40 mb-2"
                      />
                    ) : (
                      <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{l.lesson}</p>
                    )}
                    {l.context && <p className="text-xs text-text-subtle mt-1 italic">context: {l.context}</p>}
                    {l.review_note && <p className="text-xs text-danger mt-1">nota: {l.review_note}</p>}

                    {filter === "pending" && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/60 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditingId(l.id); setEditText(l.lesson); }}
                          disabled={isBusy || isEditing}
                          className="p-1.5 text-text-muted hover:text-noa rounded hover:bg-bg-base"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <div className="ml-auto flex items-center gap-1">
                          <button
                            onClick={() => handleReject(l.id)}
                            disabled={isBusy}
                            className="text-xs px-3 py-1 rounded bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 disabled:opacity-40"
                          >
                            <X className="size-3 inline mr-1" /> Rechazar
                          </button>
                          <button
                            onClick={() => handleApprove(l.id)}
                            disabled={isBusy}
                            className="text-xs px-3 py-1 rounded bg-noa/20 border border-noa/40 text-noa hover:bg-noa/30 disabled:opacity-40"
                          >
                            {isBusy ? <Loader2 className="size-3 inline mr-1 animate-spin" /> : <Check className="size-3 inline mr-1" />}
                            Aprobar
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ─── EXAMPLES TAB ───

const PRODUCTS = [
  { value: "", label: "Todos" },
  { value: "stickers", label: "Stickers" },
  { value: "web", label: "Web" },
  { value: "ads", label: "Ads" },
  { value: "print_other", label: "Print" },
  { value: "branding", label: "Branding" },
];

function ExamplesTab() {
  const [data, setData] = useState<{ examples: SalesExample[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchSalesExamples({ product, active_only: false, limit: 50 })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [product]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (id: string) => {
    setBusy(id);
    try {
      const result = await toggleKbActive(id);
      setData((prev) => prev ? {
        ...prev,
        examples: prev.examples.map((e) => e.id === id ? { ...e, active: result.active } : e),
      } : prev);
    } finally { setBusy(null); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 px-4 py-2 border-b border-border/60 overflow-x-auto">
        {PRODUCTS.map((p) => (
          <button
            key={p.value}
            onClick={() => setProduct(p.value)}
            className={`shrink-0 text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border transition ${
              product === p.value
                ? "bg-noa/10 border-noa/30 text-noa"
                : "bg-transparent border-border text-text-muted hover:bg-bg-surface"
            }`}
          >
            {p.label}
          </button>
        ))}
        {data && <span className="ml-auto text-xs text-text-subtle font-mono shrink-0">{data.total} total</span>}
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="size-5 animate-spin text-text-muted" /></div>
        ) : !data?.examples.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-muted">
            <Sparkles className="size-10 mb-3 opacity-30" />
            <p className="text-sm">Sin ejemplos en este filtro</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 px-3 py-3">
            {data.examples.map((e) => {
              const meta = e.metadata as Record<string, unknown> | null;
              const tags = (meta?.techniques as string[] | undefined) || [];
              const product = meta?.product ? String(meta.product) : "";
              const outcome = meta?.outcome ? String(meta.outcome) : "";
              const dealSize = meta?.deal_size ? String(meta.deal_size) : "";
              const isBusy = busy === e.id;
              return (
                <div
                  key={e.id}
                  className={`border rounded-lg p-2.5 text-xs transition ${
                    e.active ? "border-border bg-bg-surface" : "border-border/40 bg-bg-surface/50 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {product && <Chip>{product}</Chip>}
                    {outcome && <Chip variant={outcome === "closed_won" ? "success" : "neutral"}>{outcome}</Chip>}
                    {dealSize && <Chip>{dealSize}</Chip>}
                    {(e.hit_count ?? 0) > 0 && (
                      <span className="text-[10px] text-text-subtle font-mono">♻ {e.hit_count}</span>
                    )}
                    <button
                      onClick={() => handleToggle(e.id)}
                      disabled={isBusy}
                      className="ml-auto text-text-muted hover:text-noa"
                      title={e.active ? "Desactivar" : "Activar"}
                    >
                      {isBusy ? <Loader2 className="size-4 animate-spin" /> : e.active ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
                    </button>
                  </div>
                  <p className="text-text line-clamp-2">{e.content}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {tags.slice(0, 3).map((t) => (
                      <span key={t} className="text-[9px] text-text-subtle font-mono">#{t}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ─── METHODOLOGY TAB ───

const AUTHORS = [
  { value: "", label: "Todos" },
  { value: "brian_tracy", label: "Brian Tracy" },
  { value: "margarita_pasos", label: "Margarita Pasos" },
  { value: "vilma_nunez", label: "Vilma Núñez" },
];

function MethodologyTab() {
  const [data, setData] = useState<{ methodology: SalesMethodology[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [author, setAuthor] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchSalesMethodology({ author, active_only: false, limit: 50 })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [author]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (id: string) => {
    setBusy(id);
    try {
      const result = await toggleKbActive(id);
      setData((prev) => prev ? {
        ...prev,
        methodology: prev.methodology.map((m) => m.id === id ? { ...m, active: result.active } : m),
      } : prev);
    } finally { setBusy(null); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 px-4 py-2 border-b border-border/60 overflow-x-auto">
        {AUTHORS.map((a) => (
          <button
            key={a.value}
            onClick={() => setAuthor(a.value)}
            className={`shrink-0 text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border transition ${
              author === a.value
                ? "bg-noa/10 border-noa/30 text-noa"
                : "bg-transparent border-border text-text-muted hover:bg-bg-surface"
            }`}
          >
            {a.label}
          </button>
        ))}
        {data && <span className="ml-auto text-xs text-text-subtle font-mono shrink-0">{data.total} total</span>}
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="size-5 animate-spin text-text-muted" /></div>
        ) : !data?.methodology.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-muted">
            <Database className="size-10 mb-3 opacity-30" />
            <p className="text-sm">Sin metodologías</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 px-3 py-3">
            {data.methodology.map((m) => {
              const meta = m.metadata as Record<string, unknown> | null;
              const tags = (meta?.framework_tags as string[] | undefined) || [];
              const author = meta?.author ? String(meta.author).replace("_", " ") : "";
              const title = meta?.title ? String(meta.title).slice(0, 40) : "";
              const isBusy = busy === m.id;
              return (
                <div
                  key={m.id}
                  className={`border rounded-lg p-2.5 text-xs transition ${
                    m.active ? "border-border bg-bg-surface" : "border-border/40 bg-bg-surface/50 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {author && <Chip>{author}</Chip>}
                    {title && <span className="text-text-subtle line-clamp-1">{title}</span>}
                    {(m.hit_count ?? 0) > 0 && (
                      <span className="text-[10px] text-text-subtle font-mono">♻ {m.hit_count}</span>
                    )}
                    <button
                      onClick={() => handleToggle(m.id)}
                      disabled={isBusy}
                      className="ml-auto text-text-muted hover:text-noa"
                    >
                      {isBusy ? <Loader2 className="size-4 animate-spin" /> : m.active ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
                    </button>
                  </div>
                  <p className="text-text line-clamp-2">{m.content}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {tags.slice(0, 4).map((t) => (
                      <span key={t} className="text-[9px] text-text-subtle font-mono">#{t}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function Chip({ children, variant = "neutral" }: { children: React.ReactNode; variant?: "neutral" | "success" | "danger" }) {
  const cls =
    variant === "success"
      ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/30"
      : variant === "danger"
      ? "text-danger bg-danger/10 border-danger/30"
      : "text-text-muted bg-bg-base border-border";
  return (
    <span className={`shrink-0 text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${cls}`}>
      {children}
    </span>
  );
}
