import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Inbox, Mic, Send, MessageSquare, MessagesSquare, CheckCircle2, HandMetal, ArrowDownUp,
  GraduationCap, Check, X, Pencil, Zap, ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import {
  listInbox,
  composeReply,
  sendReply,
  declineEscalation,
  getEscalationThread,
  approveKiraLearning,
  rejectKiraLearning,
  ApiError,
  type InboxQuestion,
  type LearningProposal,
  type ThreadMessage,
} from "@/lib/api";

/** Avisa al badge del nav que la bandeja cambió (para refrescar sin esperar el poll). */
const notifyInboxChanged = () => window.dispatchEvent(new Event("noa:inbox-changed"));
import { Card } from "@/components/cards/Card";
import { Button } from "@/components/ui/Button";
import { VoiceBar } from "@/components/chat/VoiceBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { KiraLearningsSection } from "@/components/inbox/KiraLearningsSection";
import { SkillProposalsSection } from "@/components/inbox/SkillProposalsSection";
import { AtlasProposalsSection } from "@/components/inbox/AtlasProposalsSection";
import { useMediaQuery, XL_QUERY } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/cn";

/**
 * InboxPage — "Bandeja de Kira". El equipo ve las dudas que Kira escaló y las
 * responde en lenguaje natural (voz o texto). El motor del backend interpreta el
 * volcado (datos + instrucciones para Kira + ruido), compone el mensaje al cliente
 * en la voz de Kira, y —tras revisar— se envía por WhatsApp.
 *
 * S332 (brief de Noa "Consultas como chat interno"): cada duda es un HILO con Kira.
 * Kira abre («Luis me pregunta X, ¿qué le digo?»), el equipo le habla en directo, Kira
 * repregunta si le falta algo o propone el mensaje al cliente en una tarjeta editable
 * con «Enviar al cliente». El envío sigue siendo el paso 2 WYSIWYG de siempre.
 *
 * S332 F2 (rediseño de escritorio): a partir de 1280px la Bandeja es MASTER-DETAIL —
 * lista compacta a la izquierda (agrupada por etapa), hilo con Kira a la derecha a
 * pantalla completa — y suma el **modo rápido de un paso** (dictar → Kira redacta →
 * si está segura, se envía; si no, cae al hilo con su repregunta). En pantallas más
 * chicas sigue la tarjeta que se abre en el lugar. La lógica del hilo es UNA (`useThread`).
 */
type SortDir = "oldest" | "newest";
type Mode = "hilo" | "rapido";
const MODE_KEY = "noa.inbox.mode";

// S304 (pedido de Jesús): la bandeja se lee por ETAPA del contacto — quién ya tiene una
// cotización abierta (comprador), quién ya tiene pedido y quién es nuevo — para responder
// primero a quien está más cerca del dinero. La etapa la decide el backend contra KoaiHub;
// acá sólo se agrupa y se pinta. `sin_ficha` (no existe en el hub) va con los nuevos.
type StageKey = "quote" | "pedido" | "nuevo" | "sin_dato";
const STAGE_ORDER: StageKey[] = ["quote", "pedido", "nuevo", "sin_dato"];
const STAGE_TITLE: Record<StageKey, string> = {
  quote: "Compradores con quote",
  pedido: "Clientes con pedido",
  nuevo: "Sin quote ni pedido",
  sin_dato: "Sin clasificar",
};
const STAGE_HINT: Record<StageKey, string> = {
  quote: "ya tienen cotización abierta — cerrar",
  pedido: "ya compraron — cuidar la entrega",
  nuevo: "todavía sin cotizar",
  sin_dato: "KoaiHub no respondió; se muestran igual",
};
const STAGE_DOT: Record<StageKey, string> = {
  quote: "bg-[var(--color-noa)]",
  pedido: "bg-[var(--color-success)]",
  nuevo: "bg-white/35",
  sin_dato: "bg-white/20",
};
const STAGE_CHIP: Record<StageKey, string> = {
  quote: "bg-[var(--color-noa-soft)] text-[var(--color-noa)] border-[var(--color-noa)]/30",
  pedido: "bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)]/30",
  nuevo: "bg-white/[0.05] text-white/55 border-white/10",
  sin_dato: "bg-white/[0.05] text-white/40 border-white/10",
};
const stageKey = (q: InboxQuestion): StageKey =>
  q.stage === "quote" || q.stage === "pedido" ? q.stage : q.stage ? "nuevo" : "sin_dato";

function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "rapido" ? "rapido" : "hilo";
  } catch {
    return "hilo";
  }
}

export function InboxPage() {
  const [items, setItems] = useState<InboxQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sortDir, setSortDir] = useState<SortDir>("oldest");
  // S304: lo que Kira propone aprender de la última respuesta enviada. Vive en la página (no
  // en la tarjeta) porque la tarjeta desaparece al enviar y la propuesta tiene que quedar a la
  // vista hasta que alguien decida.
  const [proposals, setProposals] = useState<LearningProposal[]>([]);
  // S332 F2: escritorio master-detail.
  const isXL = useMediaQuery(XL_QUERY);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setModeState] = useState<Mode>(readMode);
  const setMode = (m: Mode) => {
    setModeState(m);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* preferencia no persistida */ }
  };

  const sortedItems = useMemo(() => {
    const ts = (q: InboxQuestion) => new Date(q.created_at || 0).getTime();
    const arr = [...items].sort((a, b) => ts(a) - ts(b)); // asc = más viejas primero
    return sortDir === "newest" ? arr.reverse() : arr;
  }, [items, sortDir]);

  // Secciones por etapa (quote → pedido → nuevo); dentro de cada una manda el orden elegido.
  const groups = useMemo(
    () =>
      STAGE_ORDER.map((key) => ({ key, rows: sortedItems.filter((q) => stageKey(q) === key) })).filter(
        (g) => g.rows.length > 0,
      ),
    [sortedItems],
  );
  const stageSummary = useMemo(() => {
    const parts: string[] = [];
    const n = (k: StageKey) => groups.find((g) => g.key === k)?.rows.length ?? 0;
    if (n("quote")) parts.push(`${n("quote")} con quote`);
    if (n("pedido")) parts.push(`${n("pedido")} con pedido`);
    if (n("nuevo")) parts.push(`${n("nuevo")} sin cotizar`);
    return parts.join(" · ");
  }, [groups]);

  const load = () => {
    setLoading(true);
    setLoadError(false);
    listInbox()
      .then(setItems)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, []);

  const removeItem = (id: string) => {
    setItems((prev) => {
      const idx = prev.findIndex((q) => q.id === id);
      const next = prev.filter((q) => q.id !== id);
      // Escritorio: al resolver, pasar a la siguiente de la lista (mismo orden visual).
      if (selectedId === id) {
        const sorted = [...next].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
        if (sortDir === "newest") sorted.reverse();
        const removedSorted = sortedItems.filter((q) => q.id !== id);
        const candidate = removedSorted[Math.min(idx, removedSorted.length - 1)] ?? sorted[0];
        setSelectedId(candidate?.id ?? null);
      }
      return next;
    });
    notifyInboxChanged();
  };

  const addProposal = (p: LearningProposal) =>
    setProposals((prev) => (prev.some((x) => x.id === p.id) ? prev : [p, ...prev]));

  const selected = selectedId ? items.find((q) => q.id === selectedId) ?? null : null;

  const header = (
    <header className={cn("px-6 pt-6 pb-3 flex items-start justify-between gap-3", isXL && "px-5")}>
      <div className="min-w-0">
        <h1 className="display text-[24px] md:text-[28px] font-semibold text-white mb-1">
          Bandeja
        </h1>
        <p className="text-sm text-white/45">
          {items.length > 0
            ? `${items.length} ${items.length === 1 ? "duda" : "dudas"} que Kira te escaló${stageSummary && !isXL ? ` · ${stageSummary}` : ""}`
            : "Dudas que Kira escala cuando no sabe la respuesta"}
        </p>
      </div>
      {items.length > 1 && (
        <button
          onClick={() => setSortDir((d) => (d === "oldest" ? "newest" : "oldest"))}
          className="shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-full bg-[var(--color-bg-elevated)] border border-white/[0.08] text-[13px] text-white/80 hover:text-white hover:border-white/20 transition"
          aria-label="Cambiar orden"
          title="Cambiar orden"
        >
          <ArrowDownUp className="size-3.5" />
          <span className="hidden sm:inline">
            {sortDir === "oldest" ? "Más antiguas" : "Más recientes"}
          </span>
        </button>
      )}
    </header>
  );

  const loadingBlock = (
    <div className="space-y-3 pt-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} variant="rect" height={isXL ? 64 : 110} className="rounded-2xl" />
      ))}
    </div>
  );
  const errorBlock = (
    <div className="flex flex-col items-center py-16 text-center">
      <p className="text-white/75 text-[15px] mb-1">No se pudo cargar la bandeja.</p>
      <p className="text-white/45 text-[13px] mb-4">Revisá tu conexión e intentá de nuevo.</p>
      <button
        onClick={load}
        className="px-4 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-white/90 text-[14px] transition-colors"
      >
        Reintentar
      </button>
    </div>
  );

  // ── Escritorio ≥1280: master-detail ──
  if (isXL) {
    return (
      <div className="h-full flex min-w-0">
        {/* Lista */}
        <div className="w-[400px] 2xl:w-[440px] shrink-0 h-full flex flex-col border-r border-[var(--color-border)]">
          {header}
          <div className="flex-1 overflow-y-auto px-3 pb-6">
            {loading ? (
              <div className="px-2">{loadingBlock}</div>
            ) : loadError ? (
              errorBlock
            ) : items.length === 0 ? (
              <EmptyState compact />
            ) : (
              groups.map((g) => (
                <section key={g.key} className="mb-4" aria-label={STAGE_TITLE[g.key]}>
                  <h2 className="px-2 pt-2 pb-1.5 flex items-baseline gap-2 mono text-[10px] uppercase tracking-[0.12em] text-white/45">
                    <span className={cn("inline-block size-1.5 rounded-full translate-y-[-1px]", STAGE_DOT[g.key])} />
                    <span className="text-white/70">{STAGE_TITLE[g.key]}</span>
                    <span>· {g.rows.length}</span>
                  </h2>
                  <div className="space-y-0.5">
                    {g.rows.map((q) => (
                      <InboxRow key={q.id} q={q} selected={q.id === selectedId} onSelect={() => setSelectedId(q.id)} />
                    ))}
                  </div>
                </section>
              ))
            )}
            {!loading && !loadError && items.length > 0 && (
              <button
                onClick={() => setSelectedId(null)}
                className={cn(
                  "mt-2 w-full text-left px-3 h-10 rounded-xl text-[13px] transition-colors",
                  selectedId === null ? "bg-white/[0.06] text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white/85",
                )}
              >
                Lecciones y propuestas →
              </button>
            )}
          </div>
        </div>

        {/* Detalle */}
        <div className="flex-1 min-w-0 h-full overflow-hidden">
          {selected ? (
            <InboxDetailPane
              key={selected.id}
              q={selected}
              mode={mode}
              onModeChange={setMode}
              onResolved={() => removeItem(selected.id)}
              onProposal={addProposal}
            />
          ) : (
            <div className="h-full overflow-y-auto px-8 py-8">
              <div className="max-w-2xl space-y-4">
                {proposals.map((p) => (
                  <LearningProposalCard key={p.id} proposal={p} onDone={() => setProposals((prev) => prev.filter((x) => x.id !== p.id))} />
                ))}
                {!loading && items.length > 0 && proposals.length === 0 && (
                  <div className="flex items-center gap-3 text-white/45 text-[14px] pb-2">
                    <MessagesSquare className="size-5" />
                    Elegí una duda de la lista para hablar con Kira. Acá abajo, lo que espera tu OK.
                  </div>
                )}
                {!loading && <KiraLearningsSection />}
                {!loading && <SkillProposalsSection />}
                {!loading && <AtlasProposalsSection />}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Móvil / tablet: tarjetas que se abren en el lugar ──
  return (
    <div className="h-full flex flex-col">
      {header}
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="max-w-2xl space-y-3">
          {loading ? loadingBlock : loadError ? errorBlock : null}
          {proposals.map((p) => (
            <LearningProposalCard
              key={p.id}
              proposal={p}
              onDone={() => setProposals((prev) => prev.filter((x) => x.id !== p.id))}
            />
          ))}
          {loading || loadError ? null : items.length === 0 ? (
            <EmptyState />
          ) : (
            groups.map((g) => (
              <section key={g.key} className="space-y-3" aria-label={STAGE_TITLE[g.key]}>
                <h2 className="pt-2 flex items-baseline gap-2 mono text-[10px] uppercase tracking-[0.12em] text-white/45">
                  <span className={cn("inline-block size-1.5 rounded-full translate-y-[-1px]", STAGE_DOT[g.key])} />
                  <span className="text-white/70">{STAGE_TITLE[g.key]}</span>
                  <span>· {g.rows.length}</span>
                  <span className="normal-case tracking-normal text-white/35 hidden sm:inline">— {STAGE_HINT[g.key]}</span>
                </h2>
                {g.rows.map((q) => (
                  <InboxItem key={q.id} q={q} onResolved={() => removeItem(q.id)} onProposal={addProposal} />
                ))}
              </section>
            ))
          )}
          {/* S288: lo que Kira aprendió y espera tu OK — misma bandeja, misma persona */}
          {!loading && <KiraLearningsSection />}
          {!loading && <SkillProposalsSection />}
          {/* S331: cambios de ads que ATLAS propone — misma bandeja, misma persona (ADR 0052) */}
          {!loading && <AtlasProposalsSection />}
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// Fila de la lista (escritorio)
// ===================================================================

function InboxRow({ q, selected, onSelect }: { q: InboxQuestion; selected: boolean; onSelect: () => void }) {
  const question = q.question.replace(/^💰\s*/, "");
  return (
    <button
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-xl transition-colors",
        selected ? "bg-white/[0.08]" : "hover:bg-white/[0.04]",
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("flex-1 min-w-0 truncate text-[14px] font-medium", selected ? "text-white" : "text-white/90")}>
          {q.kind === "precio" && <span className="mr-1" aria-label="precio">💰</span>}
          {q.contact_name}
        </span>
        {q.waiting && (
          <span className="mono text-[10px] text-white/40 shrink-0 tabular-nums">{q.waiting.replace(/^hace\s/, "")}</span>
        )}
      </div>
      <p className="mt-0.5 text-[13px] text-white/55 leading-snug line-clamp-2">{question}</p>
      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
        {q.stage_label && (
          <span className={cn("inline-flex items-center text-[10px] leading-none px-2 py-1 rounded-full border truncate max-w-full", STAGE_CHIP[stageKey(q)])}>
            {q.stage_label}
          </span>
        )}
        {q.in_discussion && (
          <span className="inline-flex items-center gap-1 text-[10px] leading-none px-2 py-1 rounded-full border bg-[var(--color-noa-soft)] text-[var(--color-noa)] border-[var(--color-noa)]/30">
            <MessagesSquare className="size-3" />
            Kira · {q.thread_count}
          </span>
        )}
        {q.missing_order && (
          <span className="inline-flex items-center text-[10px] leading-none px-2 py-1 rounded-full border bg-[var(--color-warning)]/12 text-[var(--color-warning)] border-[var(--color-warning)]/25">
            sin pedido en el hub
          </span>
        )}
      </div>
    </button>
  );
}

// ===================================================================
// El hilo con Kira — UNA lógica para la tarjeta (móvil) y el panel (escritorio)
// ===================================================================

type QuickResult = "sent" | "needs_more" | "error";

function useThread(q: InboxQuestion, onResolved: () => void, onProposal?: (p: LearningProposal) => void) {
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [input, setInput] = useState("");
  const [lastInput, setLastInput] = useState("");
  // Borrador que Kira propone al cliente (editable). null = todavía no hay propuesta vigente.
  const [draft, setDraft] = useState<string | null>(null);
  const [confident, setConfident] = useState(true);
  const [voiceActive, setVoiceActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const isPrice = q.kind === "precio";

  const scrollToEnd = () => requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: "nearest" }));

  const priceOpening = (): ThreadMessage => ({
    id: "opening", sender: "kira", message_type: "internal_query",
    content: `${q.contact_name} me pide precio: «${q.question.replace(/^💰\s*/, "")}»${q.context ? `\n\nSpecs: ${q.context}` : ""}\n\nDecime el monto y a qué aplica (ej: «$85 por 100 unidades») y yo le armo el mensaje.`,
  });

  const openThread = useCallback(async () => {
    setOpen(true);
    if (isPrice) {
      setThread([priceOpening()]); // precio: template determinístico, sin hilo (el número lo pone el humano)
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    setThreadLoading(true);
    try {
      const res = await getEscalationThread(q.id);
      setThread(res.messages);
      // Si la última propuesta de Kira sigue viva, retomarla como borrador editable.
      const lastKira = [...res.messages].reverse().find((m) => m.sender === "kira" && m.message_type !== "system_action");
      if (lastKira?.message_type === "client_preview") {
        setDraft(lastKira.content);
        setConfident(true);
      } else {
        setDraft(null); // si hay borrador tentativo detrás de una repregunta, primero se le contesta
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        toast("Esa duda ya no está pendiente.");
        onResolved();
      } else {
        toast.error("No pude abrir la conversación con Kira.");
      }
    } finally {
      setThreadLoading(false);
      scrollToEnd();
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.id, isPrice]);

  const handleVoice = (text: string) => {
    setVoiceActive(false);
    setInput((prev) => (prev ? `${prev} ${text}` : text));
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const pushLocalUser = (text: string) => {
    setThread((prev) => [...prev, {
      id: `local-${Date.now()}`, sender: "user", content: text, message_type: "internal_reply",
      created_at: new Date().toISOString(),
    }]);
    setLastInput(text);
    scrollToEnd();
  };

  /** Errores de compose compartidos entre el hilo y el modo rápido. Devuelve true si se manejó. */
  const handleComposeError = (e: unknown): boolean => {
    if (e instanceof ApiError && (e.status === 404 || e.status === 409)) {
      toast("Esa duda ya no está pendiente (otra persona la tomó).");
      onResolved();
      return true;
    }
    if (e instanceof ApiError && e.status === 400 && e.data && typeof e.data === "object" && "error" in e.data) {
      // Precio: el extractor no entendió el monto — Kira lo dice en el hilo.
      setThread((prev) => [...prev, {
        id: `local-kira-${Date.now()}`, sender: "kira", message_type: "internal_query",
        content: String((e.data as { error: string }).error), created_at: new Date().toISOString(),
      }]);
      scrollToEnd();
      return true;
    }
    toast.error("Kira no pudo procesar eso. Intentá de nuevo.");
    return false;
  };

  /** Decirle algo a Kira: guarda el turno, Kira contesta (borrador o repregunta). */
  const tell = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    pushLocalUser(text);
    setInput("");
    try {
      const res = await composeReply(q.id, text);
      const kiraMsg: ThreadMessage = res.thread_message ?? {
        id: `local-kira-${Date.now()}`,
        sender: "kira",
        content: res.confident ? (res.draft || "").trim() : (res.kira_says || res.reason || "").trim(),
        message_type: res.confident ? "client_preview" : "internal_query",
        meta: res.confident ? null : { draft: res.draft },
        created_at: new Date().toISOString(),
      };
      setThread((prev) => [...prev, kiraMsg]);
      setConfident(Boolean(res.confident));
      setDraft(res.confident && (res.draft || "").trim() ? (res.draft || "").trim() : null);
      scrollToEnd();
    } catch (e) {
      handleComposeError(e);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const sendFinal = async (finalMsg: string, rawInput: string): Promise<boolean> => {
    const res = await sendReply(q.id, finalMsg, rawInput);
    if (res.status === "sent") {
      toast.success(`Enviado a ${res.contact_name || q.contact_name} ✅`);
      if (res.learning_proposal && res.learning_proposal.id) onProposal?.(res.learning_proposal);
      onResolved();
      return true;
    }
    if (res.status === "taken") {
      toast(res.message || "Otra persona ya respondió esta duda.");
      onResolved();
      return true;
    }
    if (res.status === "standby") {
      toast(res.message || "Otra persona está atendiendo ese chat.");
      return false;
    }
    toast.error(res.message || "No se pudo enviar. Quedó pendiente.");
    return false;
  };

  /** Paso 2 WYSIWYG: envía el texto EXACTO de la tarjeta. */
  const send = async () => {
    const finalMsg = (draft || "").trim();
    if (!finalMsg || busy) return;
    setBusy(true);
    try {
      await sendFinal(finalMsg, lastInput);
    } catch {
      toast.error("No se pudo enviar. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  /**
   * S332 F2 — modo rápido (Sasha, 5 minutos): un dictado → Kira redacta → si está SEGURA se
   * envía en el acto; si repregunta, la conversación queda armada y el panel cae al hilo. El
   * envío sigue pasando por /send (claim atómico, recheck de humano): sólo se ahorra la
   * lectura del borrador cuando Kira no dudó.
   */
  const quickSend = async (text: string): Promise<QuickResult> => {
    const t = text.trim();
    if (!t || busy) return "error";
    setBusy(true);
    setOpen(true);
    if (isPrice && thread.length === 0) setThread([priceOpening()]);
    pushLocalUser(t);
    setInput("");
    try {
      const res = await composeReply(q.id, t);
      const d = (res.draft || "").trim();
      const kiraMsg: ThreadMessage = res.thread_message ?? {
        id: `local-kira-${Date.now()}`, sender: "kira",
        content: res.confident ? d : (res.kira_says || res.reason || "").trim(),
        message_type: res.confident ? "client_preview" : "internal_query",
        meta: res.confident ? null : { draft: res.draft }, created_at: new Date().toISOString(),
      };
      setThread((prev) => [...prev, kiraMsg]);
      if (res.confident && d) {
        const ok = await sendFinal(d, t);
        if (ok) return "sent";
        // standby / error de envío: dejar el borrador a la vista para reintentar desde el hilo
        setDraft(d);
        setConfident(true);
        return "needs_more";
      }
      setConfident(false);
      setDraft(null);
      scrollToEnd();
      return "needs_more";
    } catch (e) {
      handleComposeError(e);
      return "error";
    } finally {
      setBusy(false);
    }
  };

  /** Abrir como borrador el texto tentativo que Kira guardó al repreguntar. */
  const useTentativeDraft = () => {
    const lastKira = [...thread].reverse().find((m) => m.sender === "kira" && m.message_type !== "system_action");
    const d = lastKira?.meta && typeof lastKira.meta.draft === "string" ? lastKira.meta.draft.trim() : "";
    if (d) {
      setDraft(d);
      setConfident(false);
    }
  };

  const decline = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await declineEscalation(q.id);
      toast("Kira la deja en tus manos. Sacada de la bandeja.");
      onResolved();
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 409)) {
        onResolved();
      } else {
        toast.error("No se pudo. Intentá de nuevo.");
      }
    } finally {
      setBusy(false);
    }
  };

  const lastKira = [...thread].reverse().find((m) => m.sender === "kira" && m.message_type !== "system_action");
  const hasTentative = Boolean(lastKira?.meta && typeof lastKira.meta.draft === "string" && lastKira.meta.draft.trim()) && draft === null;

  const focusInput = () => inputRef.current?.focus();

  const state = {
    open, setOpen, thread, threadLoading, input, setInput, draft, setDraft, confident, voiceActive, setVoiceActive,
    busy, isPrice, openThread, handleVoice, tell, send, quickSend, useTentativeDraft, decline, hasTentative, focusInput,
  };
  const refs = { inputRef, endRef };
  return [state, refs] as const;
}

type ThreadState = ReturnType<typeof useThread>[0];
type ThreadRefs = ReturnType<typeof useThread>[1];

/** Cuerpo del hilo: burbujas + tarjeta de la propuesta + caja para hablarle a Kira. */
function ThreadBody({ q, t, inputRef, endRef, fill = false }: { q: InboxQuestion; t: ThreadState; inputRef: ThreadRefs["inputRef"]; endRef: ThreadRefs["endRef"]; fill?: boolean }) {
  return (
    <div className={cn("space-y-3", fill && "h-full flex flex-col")}>
      {/* Hilo */}
      <div className={cn("space-y-2 overflow-y-auto pr-1 -mr-1", fill ? "flex-1 min-h-0" : "max-h-[46vh]")} aria-live="polite">
        {t.threadLoading ? (
          <Skeleton variant="rect" height={64} className="rounded-2xl" />
        ) : (
          t.thread.map((m) => <ThreadBubble key={m.id} m={m} />)
        )}
        {t.busy && t.draft === null && (
          <p className="mono text-[10px] uppercase tracking-[0.12em] text-white/35 pl-1">Kira está pensando…</p>
        )}
        <div ref={endRef} />
      </div>

      {/* Borrador tentativo tras una repregunta */}
      {t.hasTentative && (
        <button
          onClick={t.useTentativeDraft}
          className="text-[12px] text-white/55 hover:text-white/85 underline underline-offset-2 transition-colors self-start"
        >
          Ver igual el borrador que Kira tenía armado
        </button>
      )}

      {/* Propuesta al cliente: tarjeta destacada, editable, con envío */}
      {t.draft !== null && (
        <div className={cn(
          "rounded-2xl border p-3 space-y-2 shrink-0",
          t.confident ? "border-[var(--color-noa)]/35 bg-[var(--color-noa-soft)]/40" : "border-[var(--color-warning)]/40 bg-[var(--color-warning)]/8",
        )}>
          <div className="flex items-center gap-2">
            <Pencil className="size-3.5 text-white/55" />
            <p className="mono text-[10px] uppercase tracking-[0.12em] text-white/55">
              Así le llegaría a {q.contact_name} por WhatsApp — editá si querés
            </p>
            {!t.confident && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-warning)]/15 text-[var(--color-warning)]">
                revisá bien
              </span>
            )}
          </div>
          <textarea
            value={t.draft}
            onChange={(e) => t.setDraft(e.target.value)}
            disabled={t.busy}
            aria-label="Mensaje final para el cliente"
            rows={4}
            className="w-full resize-none rounded-xl px-3.5 py-2.5 text-[15px] text-white outline-none disabled:opacity-60 bg-[var(--color-bg-input)] border border-[var(--color-border-hi)] focus:border-[var(--color-noa)]/40"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <Button leadingIcon={<Send className="size-4" />} onClick={t.send} disabled={!t.draft.trim() || t.busy}>
              {t.busy ? "Enviando…" : "Enviar al cliente"}
            </Button>
            <Button variant="ghost" onClick={t.focusInput} disabled={t.busy}>
              Pedirle un ajuste a Kira
            </Button>
          </div>
        </div>
      )}

      {/* Caja para hablarle a Kira */}
      <div className="shrink-0">
        <AnimatePresence mode="wait">
          {t.voiceActive ? (
            <VoiceBar key="voice" onTranscript={t.handleVoice} onCancel={() => t.setVoiceActive(false)} />
          ) : (
            <div key="text" className="relative">
              <textarea
                ref={inputRef}
                value={t.input}
                onChange={(e) => t.setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void t.tell();
                  }
                }}
                disabled={t.busy}
                aria-label="Decirle a Kira qué responder"
                placeholder={t.isPrice
                  ? "Ej: $85 por 100 unidades, precio final"
                  : t.draft !== null
                    ? "Ej: sacale el emoji y decile que el diseño va incluido"
                    : "Ej: dile que sí, son $140 y entrega el viernes; el diseño va incluido si confirma hoy"}
                rows={2}
                className="w-full resize-none rounded-2xl bg-[var(--color-bg-input)] border border-[var(--color-border-hi)] px-4 py-3 pr-24 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-[var(--color-noa)]/40 disabled:opacity-60"
              />
              <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
                <button
                  onClick={() => t.setVoiceActive(true)}
                  aria-label="Dictar por voz"
                  disabled={t.busy}
                  className="size-9 rounded-full flex items-center justify-center bg-white/[0.08] hover:bg-white/[0.15] text-white/85 transition-colors disabled:opacity-40"
                >
                  <Mic className="size-4" />
                </button>
                <button
                  onClick={() => void t.tell()}
                  aria-label="Decirle a Kira"
                  disabled={t.busy || !t.input.trim()}
                  className="size-9 rounded-full flex items-center justify-center bg-[var(--color-noa)] text-black hover:opacity-90 transition-opacity disabled:opacity-30"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ===================================================================
// Panel de detalle (escritorio): encabezado + modo Hilo / Rápido
// ===================================================================

function InboxDetailPane({
  q, mode, onModeChange, onResolved, onProposal,
}: {
  q: InboxQuestion;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  onResolved: () => void;
  onProposal?: (p: LearningProposal) => void;
}) {
  const [t, { inputRef, endRef }] = useThread(q, onResolved, onProposal);
  const [quickInput, setQuickInput] = useState("");
  const [quickVoice, setQuickVoice] = useState(false);
  const quickRef = useRef<HTMLTextAreaElement>(null);
  // Una duda que ya tiene hilo se abre en el hilo aunque la preferencia sea rápido: hay
  // contexto que leer. El rápido es para las que arrancan de cero.
  const effectiveMode: Mode = mode === "rapido" && !q.in_discussion && t.thread.length <= 1 && t.draft === null ? "rapido" : "hilo";

  useEffect(() => {
    void t.openThread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.id]);

  useEffect(() => {
    if (effectiveMode === "rapido") requestAnimationFrame(() => quickRef.current?.focus());
  }, [effectiveMode, q.id]);

  const runQuick = async () => {
    const r = await t.quickSend(quickInput);
    if (r === "needs_more") {
      setQuickInput("");
      toast("Kira necesita un dato más — seguí en el hilo.");
      onModeChange("hilo");
    } else if (r === "sent") {
      setQuickInput("");
    }
  };

  return (
    <div className="h-full flex flex-col min-w-0">
      {/* Encabezado */}
      <div className="px-8 pt-6 pb-4 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="display text-[20px] font-semibold text-white truncate">{q.contact_name}</h2>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              {q.waiting && <span className="text-[12px] text-white/45">preguntó {q.waiting}</span>}
              {q.stage_label && (
                <span className={cn("inline-flex items-center text-[11px] leading-none px-2.5 py-1.5 rounded-full border", STAGE_CHIP[stageKey(q)])} title={q.stage_group || undefined}>
                  {q.stage_label}
                </span>
              )}
              {q.contact_phone && <span className="mono text-[11px] text-white/40">{q.contact_phone}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Selector de modo */}
            <div role="tablist" aria-label="Modo de respuesta" className="flex items-center h-9 p-0.5 rounded-full bg-[var(--color-bg-elevated)] border border-white/[0.08]">
              {(["hilo", "rapido"] as Mode[]).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => onModeChange(m)}
                  className={cn(
                    "h-8 px-3 rounded-full text-[12px] font-medium flex items-center gap-1.5 transition-colors",
                    mode === m ? "bg-white/[0.10] text-white" : "text-white/55 hover:text-white/85",
                  )}
                >
                  {m === "hilo" ? <MessagesSquare className="size-3.5" /> : <Zap className="size-3.5" />}
                  {m === "hilo" ? "Hilo" : "Rápido"}
                </button>
              ))}
            </div>
            <Button variant="ghost" leadingIcon={<HandMetal className="size-4" />} onClick={t.decline} disabled={t.busy}>
              Lo manejo yo
            </Button>
          </div>
        </div>
        {q.missing_order && (
          <p className="mt-3 text-[12px] leading-snug px-2.5 py-1.5 rounded-xl bg-[var(--color-warning)]/12 text-[var(--color-warning)] border border-[var(--color-warning)]/25 max-w-2xl">
            Este cliente no tiene ningún pedido cargado en KoaiHub. Kira no puede responder por el
            estado de algo que no existe: cargá el pedido primero y después respondé.
          </p>
        )}
      </div>

      {/* Cuerpo */}
      <div className="flex-1 min-h-0 px-8 py-5">
        <div className="h-full max-w-3xl">
          {effectiveMode === "rapido" ? (
            <div className="h-full flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
                <ThreadBubble m={t.thread[0] ?? {
                  id: "opening", sender: "kira", message_type: "internal_query",
                  content: `${q.contact_name} me está preguntando esto y no quiero inventar: «${q.question.replace(/^💰\s*/, "")}». ¿Qué le digo?${q.context ? `\n\nContexto que tengo: ${q.context}` : ""}`,
                }} />
                {t.thread.slice(1).map((m) => <ThreadBubble key={m.id} m={m} />)}
                <div className="rounded-2xl border border-[var(--color-noa)]/25 bg-[var(--color-noa-soft)]/30 px-4 py-3 text-[13px] text-white/75 leading-snug">
                  <span className="text-[var(--color-noa)] font-medium">Modo rápido.</span> Dictá la respuesta con los datos.
                  Si Kira está segura, la redacta en su voz y la envía por WhatsApp en el acto. Si le falta algo, te lo pregunta y seguís en el hilo.
                </div>
              </div>
              <div className="shrink-0 pt-3 space-y-2">
                <AnimatePresence mode="wait">
                  {quickVoice ? (
                    <VoiceBar key="voice" onTranscript={(txt) => { setQuickVoice(false); setQuickInput((p) => (p ? `${p} ${txt}` : txt)); }} onCancel={() => setQuickVoice(false)} />
                  ) : (
                    <textarea
                      key="text"
                      ref={quickRef}
                      value={quickInput}
                      onChange={(e) => setQuickInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          void runQuick();
                        }
                      }}
                      disabled={t.busy}
                      aria-label="Respuesta para que Kira redacte y envíe"
                      placeholder={t.isPrice ? "Ej: $85 por 100 unidades, precio final" : "Ej: sí, son $140 y entrega el viernes; el diseño va incluido"}
                      rows={3}
                      className="w-full resize-none rounded-2xl bg-[var(--color-bg-input)] border border-[var(--color-border-hi)] px-4 py-3 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-[var(--color-noa)]/40 disabled:opacity-60"
                    />
                  )}
                </AnimatePresence>
                <div className="flex items-center gap-2">
                  <Button variant="primary" leadingIcon={<Zap className="size-4" />} onClick={() => void runQuick()} disabled={t.busy || !quickInput.trim()}>
                    {t.busy ? "Kira redacta y envía…" : "Redactar y enviar"}
                  </Button>
                  <Button variant="ghost" leadingIcon={<Mic className="size-4" />} onClick={() => setQuickVoice(true)} disabled={t.busy}>
                    Dictar
                  </Button>
                  <span className="text-[12px] text-white/40 ml-auto">¿Querés leer antes? Cambiá a <button className="underline underline-offset-2 hover:text-white/70" onClick={() => onModeChange("hilo")}>Hilo</button>.</span>
                </div>
              </div>
            </div>
          ) : (
            <ThreadBody q={q} t={t} inputRef={inputRef} endRef={endRef} fill />
          )}
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// Tarjeta (móvil / tablet): se abre en el lugar
// ===================================================================

function InboxItem({ q, onResolved, onProposal }: { q: InboxQuestion; onResolved: () => void; onProposal?: (p: LearningProposal) => void }) {
  const [t, { inputRef, endRef }] = useThread(q, onResolved, onProposal);

  return (
    <Card
      pending
      icon={<MessageSquare className="size-[18px]" />}
      title={q.contact_name}
      subtitle={q.waiting ? `preguntó ${q.waiting}` : "duda pendiente"}
    >
      <div className="flex items-center gap-2 flex-wrap mb-2">
        {q.stage_label && (
          <span className={cn("inline-flex items-center text-[11px] leading-none px-2.5 py-1.5 rounded-full border", STAGE_CHIP[stageKey(q)])} title={q.stage_group || undefined}>
            {q.stage_label}
          </span>
        )}
        {q.in_discussion && !t.open && (
          <span className="inline-flex items-center gap-1 text-[11px] leading-none px-2.5 py-1.5 rounded-full border bg-[var(--color-noa-soft)] text-[var(--color-noa)] border-[var(--color-noa)]/30">
            <MessagesSquare className="size-3" />
            en conversación con Kira · {q.thread_count}
          </span>
        )}
      </div>
      {q.missing_order && (
        <p className="text-[12px] leading-snug px-2.5 py-1.5 rounded-xl bg-[var(--color-warning)]/12 text-[var(--color-warning)] border border-[var(--color-warning)]/25">
          Este cliente no tiene ningún pedido cargado en KoaiHub. Kira no puede responder por el
          estado de algo que no existe: cargá el pedido primero y después respondé.
        </p>
      )}
      {!t.open && (
        <>
          <p className="text-[15px] text-white/90 leading-snug whitespace-pre-wrap">{q.question}</p>
          {q.context && (
            <p className="mt-2 text-[13px] text-white/45 leading-snug border-l-2 border-white/10 pl-3">{q.context}</p>
          )}
          {q.in_discussion && q.last_kira && (
            <p className="mt-2 text-[13px] text-[var(--color-noa)]/90 leading-snug">Kira: «{q.last_kira}»</p>
          )}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Button leadingIcon={<MessagesSquare className="size-4" />} onClick={() => void t.openThread()} disabled={t.busy}>
              {q.in_discussion ? "Seguir con Kira" : "Hablar con Kira"}
            </Button>
            <Button variant="ghost" leadingIcon={<HandMetal className="size-4" />} onClick={t.decline} disabled={t.busy}>
              {t.busy ? "…" : "Lo manejo yo"}
            </Button>
          </div>
        </>
      )}
      {t.open && (
        <div className="mt-2 space-y-3">
          <ThreadBody q={q} t={t} inputRef={inputRef} endRef={endRef} />
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" leadingIcon={<HandMetal className="size-4" />} onClick={t.decline} disabled={t.busy}>
              Lo manejo yo
            </Button>
            <Button variant="ghost" leadingIcon={<ChevronLeft className="size-4" />} onClick={() => t.setOpen(false)} disabled={t.busy}>
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ===================================================================
// Piezas
// ===================================================================

/** S304: "Kira quiere aprender esto" — la lección destilada de la respuesta que acaba de salir.
 *  Aprobar la mete al prompt de Kira (sección "Respuestas del equipo"); rechazar la archiva. */
function LearningProposalCard({ proposal, onDone }: { proposal: LearningProposal; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const decide = async (approve: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (approve) {
        await approveKiraLearning(proposal.id);
        toast.success("Kira lo aprendió. La próxima vez responde sola.");
      } else {
        await rejectKiraLearning(proposal.id, "rechazada desde la Bandeja");
        toast("Descartado. Kira no lo usa.");
      }
      onDone();
    } catch {
      toast.error("No pude guardar la decisión. Queda pendiente en Lecciones.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card icon={<GraduationCap className="size-[18px] text-[var(--color-noa)]" />} title="Kira quiere aprender de tu respuesta" subtitle={`${proposal.kind} · queda guardado para la próxima duda igual`}>
      <p className="text-[15px] text-white/90 leading-snug">«{proposal.lesson}»</p>
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <Button leadingIcon={<Check className="size-4" />} onClick={() => decide(true)} disabled={busy}>
          {busy ? "…" : "Que lo aprenda"}
        </Button>
        <Button variant="ghost" leadingIcon={<X className="size-4" />} onClick={() => decide(false)} disabled={busy}>
          No
        </Button>
      </div>
    </Card>
  );
}

/** Turno del hilo como burbuja. Kira a la izquierda, el equipo a la derecha, las acciones
 *  de sistema como una línea mono al centro. La tarjeta del borrador se pinta aparte. */
function ThreadBubble({ m }: { m: ThreadMessage }) {
  if (m.message_type === "system_action") {
    return (
      <p className="mono text-[10px] uppercase tracking-[0.12em] text-white/35 text-center py-1">
        {m.content}
      </p>
    );
  }
  const kira = m.sender === "kira";
  return (
    <div className={cn("flex", kira ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug whitespace-pre-wrap",
          kira
            ? "bg-white/[0.06] text-white/90 rounded-tl-md"
            : "bg-[var(--color-noa-soft)] text-white rounded-tr-md",
        )}
      >
        {!kira && m.author && (
          <p className="mono text-[9px] uppercase tracking-[0.12em] text-white/45 mb-1">{m.author}</p>
        )}
        {kira && (
          <p className="mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-noa)]/80 mb-1">Kira</p>
        )}
        {m.content}
      </div>
    </div>
  );
}

function EmptyState({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-10 px-4" : "py-20")}>
      <div className="relative mb-3">
        <Inbox className={cn("text-white/20", compact ? "size-9" : "size-12")} />
        <CheckCircle2 className="size-5 text-[var(--color-noa)] absolute -right-1 -bottom-1" />
      </div>
      <h2 className={cn("text-white/85 mb-1", compact ? "text-[15px]" : "text-lg")}>Bandeja al día</h2>
      <p className="text-sm text-white/45 max-w-sm">
        No hay dudas pendientes. Cuando Kira no sepa algo, te va a aparecer acá para que
        le digas qué responder.
      </p>
    </div>
  );
}
