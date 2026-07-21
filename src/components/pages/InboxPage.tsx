import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Inbox, Mic, Send, MessageSquare, CheckCircle2, HandMetal, ArrowLeft, ArrowDownUp } from "lucide-react";
import { toast } from "sonner";
import {
  listInbox,
  composeReply,
  sendReply,
  declineEscalation,
  ApiError,
  type InboxQuestion,
} from "@/lib/api";

/** Avisa al badge del nav que la bandeja cambió (para refrescar sin esperar el poll). */
const notifyInboxChanged = () => window.dispatchEvent(new Event("noa:inbox-changed"));
import { Card } from "@/components/cards/Card";
import { Button } from "@/components/ui/Button";
import { VoiceBar } from "@/components/chat/VoiceBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";

/**
 * InboxPage — "Bandeja de Kira". El equipo ve las dudas que Kira escaló y las
 * responde en lenguaje natural (voz o texto). El motor del backend interpreta el
 * volcado (datos + instrucciones para Kira + ruido), compone el mensaje al cliente
 * en la voz de Kira, y —tras revisar— se envía por WhatsApp. Flujo 2 pasos:
 *   Responder → (voz/texto) → Preparar → ver/editar borrador → Enviar.
 */
type SortDir = "oldest" | "newest";

export function InboxPage() {
  const [items, setItems] = useState<InboxQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sortDir, setSortDir] = useState<SortDir>("oldest");

  const sortedItems = useMemo(() => {
    const ts = (q: InboxQuestion) => new Date(q.created_at || 0).getTime();
    const arr = [...items].sort((a, b) => ts(a) - ts(b)); // asc = más viejas primero
    return sortDir === "newest" ? arr.reverse() : arr;
  }, [items, sortDir]);

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
              ? `${items.length} ${items.length === 1 ? "duda" : "dudas"} que Kira te escaló`
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
          ) : items.length === 0 ? (
            <EmptyState />
          ) : (
            sortedItems.map((q) => (
              <InboxItem key={q.id} q={q} onResolved={() => removeItem(q.id)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

type Mode = "idle" | "responding" | "draft";

function InboxItem({
  q,
  onResolved,
}: {
  q: InboxQuestion;
  onResolved: () => void;
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
