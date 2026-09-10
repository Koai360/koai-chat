import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Inbox, Mic, Send, MessageSquare, CheckCircle2, HandMetal, ArrowLeft, ArrowDownUp, GraduationCap, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  listInbox,
  composeReply,
  sendReply,
  declineEscalation,
  approveKiraLearning,
  rejectKiraLearning,
  ApiError,
  type InboxQuestion,
  type LearningProposal,
} from "@/lib/api";

/** Avisa al badge del nav que la bandeja cambió (para refrescar sin esperar el poll). */
const notifyInboxChanged = () => window.dispatchEvent(new Event("noa:inbox-changed"));
import { Card } from "@/components/cards/Card";
import { Button } from "@/components/ui/Button";
import { VoiceBar } from "@/components/chat/VoiceBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { KiraLearningsSection } from "@/components/inbox/KiraLearningsSection";
import { SkillProposalsSection } from "@/components/inbox/SkillProposalsSection";
import { cn } from "@/lib/cn";

/**
 * InboxPage — "Bandeja de Kira". El equipo ve las dudas que Kira escaló y las
 * responde en lenguaje natural (voz o texto). El motor del backend interpreta el
 * volcado (datos + instrucciones para Kira + ruido), compone el mensaje al cliente
 * en la voz de Kira, y —tras revisar— se envía por WhatsApp. Flujo 2 pasos:
 *   Responder → (voz/texto) → Preparar → ver/editar borrador → Enviar.
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
        </div>
      </div>
    </div>
  );
}

type Mode = "idle" | "responding" | "draft";

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

function InboxItem({
  q,
  onResolved,
  onProposal,
}: {
  q: InboxQuestion;
  onResolved: () => void;
  onProposal?: (p: LearningProposal) => void;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const [rawInput, setRawInput] = useState("");
  const [draft, setDraft] = useState("");
  const [hasDraft, setHasDraft] = useState(false);
  const [confident, setConfident] = useState(true);
  const [reason, setReason] = useState("");
  const [voiceActive, setVoiceActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const rawRef = useRef<HTMLTextAreaElement>(null);

  const handleVoice = (text: string) => {
    setVoiceActive(false);
    setRawInput((prev) => (prev ? `${prev} ${text}` : text));
    requestAnimationFrame(() => rawRef.current?.focus());
  };

  const handleCompose = async () => {
    if (!rawInput.trim() || busy) return;
    setBusy(true);
    try {
      const res = await composeReply(q.id, rawInput.trim());
      setDraft((res.draft || "").trim());
      setHasDraft(true);
      setConfident(Boolean(res.confident));
      setReason(res.reason || "");
      setMode("draft");
    } catch (e) {
      // 404/409 = la duda ya la resolvió/tomó otro → sacarla (solo esta tarjeta).
      if (e instanceof ApiError && (e.status === 404 || e.status === 409)) {
        toast("Esa duda ya no está pendiente (otra persona la tomó).");
        onResolved();
      } else {
        toast.error("No pude preparar la respuesta. Intentá de nuevo.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async () => {
    const finalMsg = draft.trim();
    if (!finalMsg || busy) return;
    setBusy(true);
    try {
      const res = await sendReply(q.id, finalMsg, rawInput.trim());
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

  return (
    <Card
      pending
      icon={<MessageSquare className="size-[18px]" />}
      title={q.contact_name}
      subtitle={q.waiting ? `preguntó ${q.waiting}` : "duda pendiente"}
    >
      {q.stage_label && (
        <span
          className={cn(
            "inline-flex items-center mb-2 text-[11px] leading-none px-2.5 py-1.5 rounded-full border",
            STAGE_CHIP[stageKey(q)],
          )}
          title={q.stage_group || undefined}
        >
          {q.stage_label}
        </span>
      )}
      {q.missing_order && (
        <p className="text-[12px] leading-snug px-2.5 py-1.5 rounded-xl bg-[var(--color-warning)]/12 text-[var(--color-warning)] border border-[var(--color-warning)]/25">
          Este cliente no tiene ningún pedido cargado en KoaiHub. Kira no puede responder por el
          estado de algo que no existe: cargá el pedido primero y después respondé.
        </p>
      )}
      <p className="text-[15px] text-white/90 leading-snug whitespace-pre-wrap">{q.question}</p>
      {q.context && (
        <p className="mt-2 text-[13px] text-white/45 leading-snug border-l-2 border-white/10 pl-3">
          {q.context}
        </p>
      )}

      {mode === "idle" && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Button leadingIcon={<MessageSquare className="size-4" />} onClick={() => setMode("responding")} disabled={busy}>
            Responder
          </Button>
          <Button variant="ghost" leadingIcon={<HandMetal className="size-4" />} onClick={handleDecline} disabled={busy}>
            {busy ? "…" : "Lo manejo yo"}
          </Button>
        </div>
      )}

      {mode === "responding" && (
        <div className="mt-4 space-y-3">
          <p className="mono text-[10px] uppercase tracking-[0.12em] text-white/40">
            Decile a Kira qué responder — con datos e instrucciones, ella arma el mensaje
          </p>
          <AnimatePresence mode="wait">
            {voiceActive ? (
              <VoiceBar key="voice" onTranscript={handleVoice} onCancel={() => setVoiceActive(false)} />
            ) : (
              <div key="text" className="relative">
                <textarea
                  ref={rawRef}
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  disabled={busy}
                  aria-label="Qué responderle al cliente (datos e instrucciones para Kira)"
                  placeholder="Ej: sí imprimimos sobre las cajas, mín 100, que mande el arte en vector, ofrecele el combo con stickers pero no le des el precio del combo todavía"
                  rows={3}
                  className="w-full resize-none rounded-2xl bg-[var(--color-bg-input)] border border-[var(--color-border-hi)] px-4 py-3 pr-12 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-[var(--color-noa)]/40 disabled:opacity-60"
                />
                <button
                  onClick={() => setVoiceActive(true)}
                  aria-label="Dictar por voz"
                  disabled={busy}
                  className="absolute right-2 bottom-2 size-9 rounded-full flex items-center justify-center bg-white/[0.08] hover:bg-white/[0.15] text-white/85 transition-colors disabled:opacity-40"
                >
                  <Mic className="size-4" />
                </button>
              </div>
            )}
          </AnimatePresence>
          {!voiceActive && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={handleCompose} disabled={!rawInput.trim() || busy}>
                {busy ? "Preparando…" : "Preparar respuesta"}
              </Button>
              {hasDraft && (
                <Button variant="ghost" onClick={() => setMode("draft")} disabled={busy}>
                  Ver borrador
                </Button>
              )}
              <Button variant="ghost" onClick={() => { setMode("idle"); setRawInput(""); }} disabled={busy}>
                Cancelar
              </Button>
            </div>
          )}
        </div>
      )}

      {mode === "draft" && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <p className="mono text-[10px] uppercase tracking-[0.12em] text-white/40">
              Así le va a llegar al cliente — editá si querés
            </p>
            {!confident && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-warning)]/15 text-[var(--color-warning)]">
                revisá bien
              </span>
            )}
          </div>
          {!confident && reason && (
            <p className="text-[13px] text-[var(--color-warning)]/90 leading-snug">{reason}</p>
          )}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy}
            aria-label="Mensaje final para el cliente"
            rows={4}
            className={cn(
              "w-full resize-none rounded-2xl px-4 py-3 text-[15px] text-white outline-none disabled:opacity-60",
              "bg-[var(--color-bg-input)] border focus:border-[var(--color-noa)]/40",
              confident ? "border-[var(--color-border-hi)]" : "border-[var(--color-warning)]/40",
            )}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <Button leadingIcon={<Send className="size-4" />} onClick={handleSend} disabled={!draft.trim() || busy}>
              {busy ? "Enviando…" : "Enviar al cliente"}
            </Button>
            <Button variant="ghost" leadingIcon={<ArrowLeft className="size-4" />} onClick={() => setMode("responding")} disabled={busy}>
              Volver
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
