import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Inbox, Mic, Send, MessageSquare, MessagesSquare, CheckCircle2, HandMetal, ArrowDownUp, GraduationCap, Check, X, Pencil } from "lucide-react";
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
 */
type SortDir = "oldest" | "newest";

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

export function InboxPage() {
  const [items, setItems] = useState<InboxQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sortDir, setSortDir] = useState<SortDir>("oldest");
  // S304: lo que Kira propone aprender de la última respuesta enviada. Vive en la página (no
  // en la tarjeta) porque la tarjeta desaparece al enviar y la propuesta tiene que quedar a la
  // vista hasta que alguien decida.
  const [proposals, setProposals] = useState<LearningProposal[]>([]);

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
    setItems((prev) => prev.filter((q) => q.id !== id));
    notifyInboxChanged();
  };

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 pt-6 pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="display text-[24px] md:text-[28px] font-semibold text-white mb-1">
            Bandeja
          </h1>
          <p className="text-sm text-white/45">
            {items.length > 0
              ? `${items.length} ${items.length === 1 ? "duda" : "dudas"} que Kira te escaló${stageSummary ? ` · ${stageSummary}` : ""}`
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

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="max-w-2xl space-y-3">
          {loading ? (
            <div className="space-y-3 pt-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} variant="rect" height={110} className="rounded-2xl" />
              ))}
            </div>
          ) : loadError ? (
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
          ) : null}
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
                  <InboxItem
                    key={q.id}
                    q={q}
                    onResolved={() => removeItem(q.id)}
                    onProposal={(p) => setProposals((prev) => (prev.some((x) => x.id === p.id) ? prev : [p, ...prev]))}
                  />
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

function InboxItem({
  q,
  onResolved,
  onProposal,
}: {
  q: InboxQuestion;
  onResolved: () => void;
  onProposal?: (p: LearningProposal) => void;
}) {
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

  const openThread = async () => {
    setOpen(true);
    if (isPrice) return; // precio: template determinístico, sin hilo (el número lo pone el humano)
    setThreadLoading(true);
    try {
      const res = await getEscalationThread(q.id);
      setThread(res.messages);
      // Si la última propuesta de Kira sigue viva, retomarla como borrador editable.
      const lastKira = [...res.messages].reverse().find((m) => m.sender === "kira" && m.message_type !== "system_action");
      if (lastKira?.message_type === "client_preview") {
        setDraft(lastKira.content);
        setConfident(true);
      } else if (lastKira?.meta && typeof lastKira.meta.draft === "string" && lastKira.meta.draft.trim()) {
        setDraft(null); // hay borrador tentativo pero Kira preguntó algo: primero se le contesta
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
  };

  const handleVoice = (text: string) => {
    setVoiceActive(false);
    setInput((prev) => (prev ? `${prev} ${text}` : text));
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  /** Decirle algo a Kira: guarda el turno, Kira contesta (borrador o repregunta). */
  const handleTell = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    const localUser: ThreadMessage = {
      id: `local-${Date.now()}`, sender: "user", content: text, message_type: "internal_reply",
      created_at: new Date().toISOString(),
    };
    setThread((prev) => [...prev, localUser]);
    setInput("");
    setLastInput(text);
    scrollToEnd();
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
      if (res.confident && (res.draft || "").trim()) {
        setDraft((res.draft || "").trim());
      } else {
        setDraft(null);
      }
      scrollToEnd();
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 409)) {
        toast("Esa duda ya no está pendiente (otra persona la tomó).");
        onResolved();
      } else if (e instanceof ApiError && e.status === 400 && e.data && typeof e.data === "object" && "error" in e.data) {
        // Precio: el extractor no entendió el monto — Kira lo dice en el hilo.
        setThread((prev) => [...prev, {
          id: `local-kira-${Date.now()}`, sender: "kira", message_type: "internal_query",
          content: String((e.data as { error: string }).error), created_at: new Date().toISOString(),
        }]);
      } else {
        toast.error("Kira no pudo procesar eso. Intentá de nuevo.");
      }
      scrollToEnd();
    } finally {
      setBusy(false);
      requestAnimationFrame(() => inputRef.current?.focus());
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

  const handleSend = async () => {
    const finalMsg = (draft || "").trim();
    if (!finalMsg || busy) return;
    setBusy(true);
    try {
      const res = await sendReply(q.id, finalMsg, lastInput);
      if (res.status === "sent") {
        toast.success(`Enviado a ${res.contact_name || q.contact_name} ✅`);
        if (res.learning_proposal && res.learning_proposal.id) onProposal?.(res.learning_proposal);
        onResolved();
      } else if (res.status === "taken") {
        toast(res.message || "Otra persona ya respondió esta duda.");
        onResolved();
      } else if (res.status === "standby") {
        toast(res.message || "Otra persona está atendiendo ese chat.");
      } else {
        toast.error(res.message || "No se pudo enviar. Quedó pendiente.");
      }
    } catch {
      toast.error("No se pudo enviar. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
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

  return (
    <Card
      pending
      icon={<MessageSquare className="size-[18px]" />}
      title={q.contact_name}
      subtitle={q.waiting ? `preguntó ${q.waiting}` : "duda pendiente"}
    >
      <div className="flex items-center gap-2 flex-wrap mb-2">
        {q.stage_label && (
          <span
            className={cn(
              "inline-flex items-center text-[11px] leading-none px-2.5 py-1.5 rounded-full border",
              STAGE_CHIP[stageKey(q)],
            )}
            title={q.stage_group || undefined}
          >
            {q.stage_label}
          </span>
        )}
        {q.in_discussion && !open && (
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
      {!open && (
        <>
          <p className="text-[15px] text-white/90 leading-snug whitespace-pre-wrap">{q.question}</p>
          {q.context && (
            <p className="mt-2 text-[13px] text-white/45 leading-snug border-l-2 border-white/10 pl-3">
              {q.context}
            </p>
          )}
          {q.in_discussion && q.last_kira && (
            <p className="mt-2 text-[13px] text-[var(--color-noa)]/90 leading-snug">
              Kira: «{q.last_kira}»
            </p>
          )}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Button leadingIcon={<MessagesSquare className="size-4" />} onClick={openThread} disabled={busy}>
              {q.in_discussion ? "Seguir con Kira" : "Hablar con Kira"}
            </Button>
            <Button variant="ghost" leadingIcon={<HandMetal className="size-4" />} onClick={handleDecline} disabled={busy}>
              {busy ? "…" : "Lo manejo yo"}
            </Button>
          </div>
        </>
      )}

      {open && (
        <div className="mt-2 space-y-3">
          {/* Hilo */}
          <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1 -mr-1" aria-live="polite">
            {isPrice && (
              <ThreadBubble m={{
                id: "opening", sender: "kira", message_type: "internal_query",
                content: `${q.contact_name} me pide precio: «${q.question.replace(/^💰\s*/, "")}»${q.context ? `\n\nSpecs: ${q.context}` : ""}\n\nDecime el monto y a qué aplica (ej: «$85 por 100 unidades») y yo le armo el mensaje.`,
              }} />
            )}
            {threadLoading ? (
              <Skeleton variant="rect" height={64} className="rounded-2xl" />
            ) : (
              thread.map((m) => <ThreadBubble key={m.id} m={m} />)
            )}
            {busy && !draft && (
              <p className="mono text-[10px] uppercase tracking-[0.12em] text-white/35 pl-1">Kira está pensando…</p>
            )}
            <div ref={endRef} />
          </div>

          {/* Borrador tentativo tras una repregunta */}
          {hasTentative && (
            <button
              onClick={useTentativeDraft}
              className="text-[12px] text-white/55 hover:text-white/85 underline underline-offset-2 transition-colors"
            >
              Ver igual el borrador que Kira tenía armado
            </button>
          )}

          {/* Propuesta al cliente: tarjeta destacada, editable, con envío */}
          {draft !== null && (
            <div className={cn(
              "rounded-2xl border p-3 space-y-2",
              confident ? "border-[var(--color-noa)]/35 bg-[var(--color-noa-soft)]/40" : "border-[var(--color-warning)]/40 bg-[var(--color-warning)]/8",
            )}>
              <div className="flex items-center gap-2">
                <Pencil className="size-3.5 text-white/55" />
                <p className="mono text-[10px] uppercase tracking-[0.12em] text-white/55">
                  Así le llegaría a {q.contact_name} por WhatsApp — editá si querés
                </p>
                {!confident && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-warning)]/15 text-[var(--color-warning)]">
                    revisá bien
                  </span>
                )}
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={busy}
                aria-label="Mensaje final para el cliente"
                rows={4}
                className="w-full resize-none rounded-xl px-3.5 py-2.5 text-[15px] text-white outline-none disabled:opacity-60 bg-[var(--color-bg-input)] border border-[var(--color-border-hi)] focus:border-[var(--color-noa)]/40"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <Button leadingIcon={<Send className="size-4" />} onClick={handleSend} disabled={!draft.trim() || busy}>
                  {busy ? "Enviando…" : "Enviar al cliente"}
                </Button>
                <Button variant="ghost" onClick={() => inputRef.current?.focus()} disabled={busy}>
                  Pedirle un ajuste a Kira
                </Button>
              </div>
            </div>
          )}

          {/* Caja para hablarle a Kira */}
          <AnimatePresence mode="wait">
            {voiceActive ? (
              <VoiceBar key="voice" onTranscript={handleVoice} onCancel={() => setVoiceActive(false)} />
            ) : (
              <div key="text" className="relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      handleTell();
                    }
                  }}
                  disabled={busy}
                  aria-label="Decirle a Kira qué responder"
                  placeholder={isPrice
                    ? "Ej: $85 por 100 unidades, precio final"
                    : draft !== null
                      ? "Ej: sacale el emoji y decile que el diseño va incluido"
                      : "Ej: dile que sí, son $140 y entrega el viernes; el diseño va incluido si confirma hoy"}
                  rows={2}
                  className="w-full resize-none rounded-2xl bg-[var(--color-bg-input)] border border-[var(--color-border-hi)] px-4 py-3 pr-24 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-[var(--color-noa)]/40 disabled:opacity-60"
                />
                <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
                  <button
                    onClick={() => setVoiceActive(true)}
                    aria-label="Dictar por voz"
                    disabled={busy}
                    className="size-9 rounded-full flex items-center justify-center bg-white/[0.08] hover:bg-white/[0.15] text-white/85 transition-colors disabled:opacity-40"
                  >
                    <Mic className="size-4" />
                  </button>
                  <button
                    onClick={handleTell}
                    aria-label="Decirle a Kira"
                    disabled={busy || !input.trim()}
                    className="size-9 rounded-full flex items-center justify-center bg-[var(--color-noa)] text-black hover:opacity-90 transition-opacity disabled:opacity-30"
                  >
                    <Send className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" leadingIcon={<HandMetal className="size-4" />} onClick={handleDecline} disabled={busy}>
              Lo manejo yo
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="relative mb-3">
        <Inbox className="size-12 text-white/20" />
        <CheckCircle2 className="size-5 text-[var(--color-noa)] absolute -right-1 -bottom-1" />
      </div>
      <h2 className="text-lg text-white/85 mb-1">Bandeja al día</h2>
      <p className="text-sm text-white/45 max-w-sm">
        No hay dudas pendientes. Cuando Kira no sepa algo, te va a aparecer acá para que
        le digas qué responder.
      </p>
    </div>
  );
}
