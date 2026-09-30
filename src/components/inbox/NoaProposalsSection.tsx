import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Mail, MessageCircle, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import {
  ApiError,
  approveNoaProposal,
  listNoaProposals,
  reconcileNoaProposal,
  rejectNoaProposal,
  resolveNoaProposal,
  type NoaProposal,
  type NoaProposalDecision,
  type NoaProposalsResponse,
} from "@/lib/api";
import { Card } from "@/components/cards/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * Propuestas que Noa dejó trabajando sola — S356, ADR 0087 F3.
 * Nada sale hasta que su dueño la aprueba acá, tal cual la ve:
 * - La tarjeta muestra el texto EXACTO que se ejecuta, como texto plano (nunca Markdown).
 * - Aprobar manda el hash de ESA tarjeta: si la propuesta no es la misma, el servidor la rechaza.
 * - La respuesta separa lo que pasó en este intento del estado DURABLE; después de cualquier
 *   decisión se relee la lista y, hasta poder releerla, no se puede decidir nada más.
 * - Un envío INCIERTO reserva el destino: se concilia (el correo por su referencia; WhatsApp lo
 *   decide el dueño mirando el chat, nunca se adjudica solo).
 */
export function NoaProposalsSection() {
  const [data, setData] = useState<NoaProposalsResponse | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Barrera ÚNICA (Codex F3 PWA r1 #2): se toma ANTES de mandar cualquier decisión y se suelta solo
  // con una relectura exitosa iniciada después. Mientras está tomada no se decide nada en ninguna tarjeta.
  const [barrier, setBarrier] = useState(false);
  const barrierRef = useRef(false);
  const [rereadFailed, setRereadFailed] = useState(false);
  const [rereading, setRereading] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  // Codex F3 PWA r2: cada decisión es una GENERACIÓN; solo la relectura de ESA generación, iniciada
  // después de su POST, puede soltar la barrera. Una sola relectura de recuperación a la vez.
  const gen = useRef(0);
  const posting = useRef(false);
  const releasing = useRef(false);
  const epoch = useRef(0);
  const loadRef = useRef<(() => Promise<boolean>) | null>(null);

  const load = useCallback((): Promise<boolean> => {
    const startedAt = epoch.current;
    return listNoaProposals()
      .then((r) => {
        if (startedAt !== epoch.current) return loadRef.current ? loadRef.current() : false;
        setData(r);
        setError(null);
        return true;
      })
      .catch((e) => {
        if (startedAt !== epoch.current) return loadRef.current ? loadRef.current() : false;
        setError({ status: e instanceof ApiError ? e.status : 0, message: e instanceof Error ? e.message : "error" });
        return false;
      })
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    loadRef.current = load;
    const t = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  // Codex F3 PWA final: un estado en curso/incierto cambia en el servidor (termina, o el barrido lo
  // pasa a incierto): se relee solo cada 30 s mientras haya alguno. No toca la barrera.
  const hasTransient = !!data?.open.some((p) => p.status === "claimed" || p.status === "uncertain");
  useEffect(() => {
    if (!hasTransient) return;
    const t = window.setInterval(() => { if (!barrierRef.current) void load(); }, 30_000);
    return () => window.clearInterval(t);
  }, [hasTransient, load]);

  /** Aplica en pantalla el estado DURABLE que ya trajo la respuesta (sirve aunque la relectura falle). */
  const applyDurable = (p: NoaProposal) => {
    setData((prev) => {
      if (!prev) return prev;
      const open = prev.open.filter((x) => x.id !== p.id);
      const recent = prev.recent.filter((x) => x.id !== p.id);
      const isOpen = p.status === "pending" || p.status === "claimed" || p.status === "uncertain";
      return { ...prev, open: isOpen ? [p, ...open] : open, recent: isOpen ? recent : [p, ...recent] };
    });
  };

  const release = async (myGen: number) => {
    if (releasing.current) return;
    releasing.current = true;
    setRereading(true);
    try {
      epoch.current += 1;
      const ok = await load();
      if (myGen !== gen.current || posting.current) return;   // otra decisión: esta relectura no la libera
      if (ok) {
        barrierRef.current = false;
        setBarrier(false);
        setRereadFailed(false);
      } else {
        setRereadFailed(true);
      }
    } finally {
      releasing.current = false;
      setRereading(false);
    }
  };

  /** Una sola decisión a la vez en toda la sección; después, SIEMPRE relectura. */
  const decide = async (run: () => Promise<NoaProposalDecision>): Promise<NoaProposalDecision | null> => {
    if (barrierRef.current) {
      toast.message("Esperá: estoy terminando de registrar la decisión anterior.");
      return null;
    }
    barrierRef.current = true;
    setBarrier(true);
    const myGen = ++gen.current;
    posting.current = true;
    epoch.current += 1;          // una carga que arrancó antes ya no describe el estado
    let r: NoaProposalDecision | null = null;
    try {
      r = await run();
      if (r.proposal) applyDurable(r.proposal);
    } catch (e) {
      toast.error(`No sé cómo terminó (${e instanceof Error ? e.message : "error"}). Releo el estado.`);
    } finally {
      posting.current = false;
      await release(myGen);
    }
    return r;
  };

  if (!loaded) return null;
  if (error?.status === 403 || error?.status === 401) return null;
  const banner = error && !rereadFailed ? (
    <Card className="p-4 text-[13px] text-amber-200/90">
      No pude cargar las propuestas de Noa ({error.message}).{" "}
      <button className="underline" onClick={() => void load()}>Reintentar</button>
    </Card>
  ) : null;
  if (error && !data) return <section className="pt-6" aria-label="Propuestas de Noa">{banner}</section>;
  if (!data || (data.open.length === 0 && data.recent.length === 0)) return null;

  const pending = data.open.filter((p) => p.status === "pending");
  const attention = data.open.filter((p) => p.status !== "pending");

  return (
    <section className="pt-6 space-y-3" aria-label="Propuestas de Noa para aprobar">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-[var(--color-noa)]" />
        <h2 className="text-[15px] font-medium text-white/90">
          {pending.length === 1 ? "1 propuesta de Noa" : `${pending.length} propuestas de Noa`}
        </h2>
      </div>
      <p className="text-[13px] text-white/45 -mt-1">
        Lo que Noa dejó listo mientras revisaba sola. No se envía nada hasta que lo apruebes: sale exactamente lo que ves.
      </p>
      {banner}
      {rereadFailed && (
        <Card className="p-3 text-[13px] text-amber-200/90 flex items-center gap-2">
          <span className="flex-1">No pude releer el estado después de tu decisión. Hasta releerlo no se puede decidir nada.</span>
          <Button size="sm" variant="ghost" disabled={rereading} onClick={() => void release(gen.current)}>
            <RefreshCw className={cn("size-3.5", rereading && "animate-spin")} /> Releer
          </Button>
        </Card>
      )}
      {attention.map((p) => (
        <AttentionCard key={p.id} p={p} locked={barrier} decide={decide} refresh={() => void load()} />
      ))}
      {pending.map((p) => <ProposalCard key={p.id} p={p} locked={barrier} decide={decide} />)}
      {data.recent.length > 0 && (
        <div>
          <button className="text-[12px] text-white/40 flex items-center gap-1" onClick={() => setShowRecent((o) => !o)}>
            {showRecent ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />} Últimos 7 días ({data.recent.length})
          </button>
          {showRecent && (
            <div className="mt-2 space-y-1">
              {data.recent.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-[12px] text-white/55">
                  <span className="mono text-white/40">{p.code}</span>
                  <span>{KIND_ES[p.kind]}</span>
                  <span className="truncate">{target(p)}</span>
                  <span className={cn("ml-auto", STATUS_TONE[p.status])}>{STATUS_ES[p.status]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

type Decide = (run: () => Promise<NoaProposalDecision>) => Promise<NoaProposalDecision | null>;

const KIND_ES: Record<NoaProposal["kind"], string> = { whatsapp_reply: "WhatsApp", email_draft: "Borrador de correo" };
const STATUS_ES: Record<NoaProposal["status"], string> = {
  pending: "esperando", claimed: "en curso", executed: "hecho", failed: "no salió",
  uncertain: "sin confirmar", rejected: "rechazada", expired: "vencida",
};
const STATUS_TONE: Record<NoaProposal["status"], string> = {
  pending: "text-white/60", claimed: "text-amber-200/80", executed: "text-emerald-300/80", failed: "text-red-300/80",
  uncertain: "text-amber-200/80", rejected: "text-white/40", expired: "text-white/40",
};
const REASON_ES: Record<string, string> = {
  context_changed: "la conversación cambió desde que Noa la leyó",
  window_closed: "cerró la ventana de 24 h de WhatsApp",
  precheck_unreadable: "no pude verificar la conversación",
  begin_refused: "no se llegó a ejecutar",
  in_flight: "había otro envío en curso a ese destino",
};

function target(p: NoaProposal): string {
  return p.kind === "whatsapp_reply" ? `${p.detail.to_name || ""} ${p.detail.to_phone || ""}`.trim() : p.detail.to || "";
}

function expiresIn(iso?: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "vencida";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `vence en ${h} h ${m} min` : `vence en ${m} min`;
}

const WHY_ES: Record<string, string> = {
  ...REASON_ES,
  hash_mismatch: "la propuesta que viste no es la misma: revisala de nuevo",
  expired: "la propuesta venció",
  not_pending: "ya se había decidido en otro lado",
  not_found: "ya no existe",
};

/** El aviso se decide por el estado DURABLE (Codex F3 PWA r1 #1): `observed` solo describe este
 *  intento; si la propuesta ya salió o está incierta por otro lado, eso es lo que se dice. */
function explain(r: NoaProposalDecision, kind: NoaProposal["kind"]): void {
  const durable = r.durable_status ?? r.proposal?.status ?? null;
  const done = kind === "whatsapp_reply" ? "Salió por WhatsApp" : "El borrador quedó en Gmail";
  const why = WHY_ES[r.outcome] || r.outcome;
  switch (durable) {
    case "executed":
      if (r.observed === "executed") toast.success(done);
      else toast.success(`Ya estaba hecho (${done.toLowerCase()}). No lo repitas.`);
      return;
    case "claimed":
    case "uncertain":
      toast.warning("No sé si salió: queda sin confirmar. No lo repitas; conciliá en la tarjeta.");
      return;
    case "failed":
      toast.error("No salió: el servicio lo rechazó. No lo reintento solo.");
      return;
    case "pending":
    case "expired":
    case "rejected":
      toast.message(`No se envió nada: ${why}.`);
      return;
    default:
      toast.warning("No sé en qué estado quedó. Releo antes de dejarte decidir de nuevo.");
  }
}

function Literal({ children, className }: { children: string | undefined; className?: string }) {
  // Texto plano, escapado por React y con saltos de línea: lo que se ve es lo que se ejecuta.
  return (
    <div className={cn("rounded-md bg-white/[0.04] border border-white/10 px-3 py-2 text-[13px] text-white/85 whitespace-pre-wrap break-words", className)}>
      {children || ""}
    </div>
  );
}

function Header({ p }: { p: NoaProposal }) {
  const Icon = p.kind === "whatsapp_reply" ? MessageCircle : Mail;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Icon className="size-4 text-white/60" />
      <span className="text-[14px] font-medium text-white/90">{KIND_ES[p.kind]}</span>
      <span className="mono text-[11px] text-white/45">{p.code}</span>
      {p.responsibility_title && <span className="text-[12px] text-white/40 truncate">· {p.responsibility_title}</span>}
      <span className="ml-auto mono text-[11px] text-white/45">{p.status === "pending" ? expiresIn(p.expires_at) : STATUS_ES[p.status]}</span>
    </div>
  );
}

function Detail({ p }: { p: NoaProposal }) {
  const d = p.detail;
  if (p.kind === "whatsapp_reply") {
    return (
      <div className="space-y-1.5">
        <div className="text-[13px] text-white/70">
          Para <span className="text-white/90">{d.to_name}</span> · <span className="mono text-[12px]">{d.to_phone}</span>
          <span className="text-white/40"> · {d.channel_label} ({d.channel_id})</span>
        </div>
        <Literal>{d.text}</Literal>
      </div>
    );
  }
  return (
    <div className="space-y-1.5 text-[13px]">
      <div className="text-white/70">De <span className="text-white/90">{d.from}</span></div>
      <div className="text-white/70">Para <span className="text-white/90">{d.to}</span></div>
      <div className="text-white/70">Asunto <span className="text-white/90">{d.subject}</span></div>
      <Literal className="max-h-72 overflow-y-auto">{d.body}</Literal>
      <div className="text-[12px] text-white/40">Queda como borrador en Gmail, dentro del hilo: lo enviás vos desde ahí.</div>
    </div>
  );
}

function ProposalCard({ p, locked, decide }: { p: NoaProposal; locked: boolean; decide: Decide }) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");

  const approve = async () => {
    if (busy || locked) return;
    setBusy("approve");
    const r = await decide(() => approveNoaProposal(p.id, p.payload_hash));
    if (r) explain(r, p.kind);
    setBusy(null);
  };

  const reject = async () => {
    if (busy || locked) return;
    if (note.trim().length < 3) { toast.error("Contale a Noa en una línea por qué no: aprende del rechazo"); return; }
    setBusy("reject");
    const r = await decide(() => rejectNoaProposal(p.id, note.trim()));
    if (r?.outcome === "rejected") toast.success("Propuesta rechazada");
    else if (r) explain(r, p.kind);
    setBusy(null);
  };

  return (
    <Card className="p-4 space-y-2.5">
      <Header p={p} />
      <Detail p={p} />
      {p.reason && <p className="text-[12px] text-white/50">Por qué: {p.reason}</p>}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" disabled={busy !== null || locked} onClick={() => void approve()}>
          <Check className="size-4" />
          {busy === "approve" ? "Ejecutando…" : p.kind === "whatsapp_reply" ? "Aprobar y enviar" : "Aprobar borrador"}
        </Button>
        <input
          value={note} onChange={(e) => setNote(e.target.value)} placeholder="Por qué no (para rechazar)"
          className="order-last basis-full sm:order-none sm:basis-auto sm:flex-1 min-w-0 bg-white/5 rounded px-2 py-1.5 text-[13px] text-white/80 outline-none"
        />
        <Button size="sm" variant="ghost" disabled={busy !== null || locked} onClick={() => void reject()}>
          <X className="size-4" /> {busy === "reject" ? "…" : "Rechazar"}
        </Button>
      </div>
      <div className="mono text-[10px] text-white/25">hash {p.payload_hash.slice(0, 12)}</div>
    </Card>
  );
}

function AttentionCard({ p, locked, decide, refresh }: { p: NoaProposal; locked: boolean; decide: Decide; refresh: () => void }) {
  const [busy, setBusy] = useState<"reconcile" | "sent" | "not_sent" | null>(null);
  const [candidates, setCandidates] = useState<NoaProposalDecision["candidates"]>(undefined);
  const [note, setNote] = useState("");

  const reconcile = async () => {
    if (busy || locked) return;
    setBusy("reconcile");
    const r = await decide(() => reconcileNoaProposal(p.id));
    if (r?.outcome === "resolved") toast.success("Confirmado con evidencia: sí salió");
    else if (r?.error) toast.error(r.error);
    else if (r) {
      setCandidates(r.candidates || []);
      toast.message(p.kind === "whatsapp_reply" ? "Revisá el chat y decí si salió" : "No encontré el borrador todavía");
    }
    setBusy(null);
  };

  const resolve = async (outcome: "sent" | "not_sent") => {
    if (busy || locked) return;
    if (note.trim().length < 3) { toast.error("Contá en una línea qué viste"); return; }
    setBusy(outcome);
    const r = await decide(() => resolveNoaProposal(p.id, outcome, note.trim()));
    if (r?.outcome === "resolved") toast.success(outcome === "sent" ? "Marcado como enviado" : "Marcado como no enviado");
    else if (r?.outcome === "executor_alive") toast.error("El intento anterior podría seguir en curso; probá en unos minutos");
    else if (r) explain(r, p.kind);
    setBusy(null);
  };

  return (
    <Card className="p-4 space-y-2.5 border border-amber-300/20">
      <Header p={p} />
      <div className="text-[13px] text-amber-200/90">
        {p.status === "claimed"
          ? "Aprobada y en curso (o cortada a mitad). Si en unos minutos sigue así, queda para conciliar."
          : "No sé si salió: el destino queda reservado hasta confirmarlo. Nunca lo repito solo."}
      </div>
      <Detail p={p} />
      {candidates && candidates.length > 0 && (
        <div className="text-[12px] text-white/55">
          En el chat hay {candidates.length} mensaje(s) salientes con este mismo texto después de la aprobación
          (pueden ser de Kira u otra integración): {candidates.map((c) => new Date(c.at).toLocaleTimeString()).join(", ")}.
        </div>
      )}
      {p.status === "claimed" && (
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" variant="ghost" disabled={locked} onClick={refresh}>
            <RefreshCw className="size-3.5" /> Actualizar
          </Button>
          <span className="text-[12px] text-white/40">Se actualiza sola cada 30 s.</span>
        </div>
      )}
      {p.status === "uncertain" && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" variant="ghost" disabled={busy !== null || locked} onClick={() => void reconcile()}>
            <RefreshCw className={cn("size-3.5", busy === "reconcile" && "animate-spin")} /> Conciliar
          </Button>
          <input
            value={note} onChange={(e) => setNote(e.target.value)} placeholder="Qué viste (para marcar)"
            className="order-last basis-full sm:order-none sm:basis-auto sm:flex-1 min-w-0 bg-white/5 rounded px-2 py-1.5 text-[13px] text-white/80 outline-none"
          />
          <Button size="sm" variant="ghost" disabled={busy !== null || locked || !p.can_mark_sent}
                  title={p.can_mark_sent ? "" : "Disponible cuando el intento de envío haya terminado"}
                  onClick={() => void resolve("sent")}>Sí salió</Button>
          <Button size="sm" variant="ghost" disabled={busy !== null || locked || !p.can_mark_not_sent}
                  title={p.can_mark_not_sent ? "" : "Disponible 10 min después del intento, cuando ya no puede seguir en curso"}
                  onClick={() => void resolve("not_sent")}>No salió</Button>
        </div>
      )}
    </Card>
  );
}
