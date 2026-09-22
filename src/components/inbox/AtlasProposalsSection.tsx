import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Megaphone, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import {
  approveAtlasProposal,
  getAtlasProposal,
  listAtlasProposals,
  markAtlasProposalSeen,
  reconcileAtlasProposal,
  rejectAtlasProposal,
  type AtlasProposal,
  type AtlasProposalsResponse,
} from "@/lib/api";
import { ApiError } from "@/lib/api";
import { Card } from "@/components/cards/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * Propuestas de ATLAS (ads) que esperan la decisión de Jesús — S331, ADR 0052.
 * Ningún cambio de dinero (pausar, presupuesto, negativas) se aplica sin un toque acá.
 * - Aprobar manda `expected_hash`: si la propuesta cambió, el servidor rechaza.
 * - El servidor devuelve el estado DURABLE: `executed` (verificado por relectura),
 *   `failed` (rechazo explícito) o `uncertain` (el POST pudo aplicarse: reserva el recurso
 *   hasta que alguien reconcilie). La tarjeta relee antes de desaparecer.
 * - "Vista" se marca cuando la tarjeta se MUESTRA (viewport + pestaña visible), no al cargar.
 * - Un fallo al listar se muestra como tal: no se confunde con bandeja vacía.
 */
export function AtlasProposalsSection() {
  const [data, setData] = useState<AtlasProposalsResponse | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const inflight = useRef<string | null>(null);
  // Cada decisión (aprobar/rechazar/reconciliar/releer) sube la época: una respuesta de listado
  // iniciada ANTES de una decisión ya no describe el estado y se descarta (y se vuelve a pedir).
  const epoch = useRef(0);
  const loadRef = useRef<((after?: string) => Promise<void>) | null>(null);

  const load = useCallback((after = ""): Promise<void> => {
    // Una sola carga por cursor: dos clics en "Ver más" con el mismo cursor no duplican filas
    if (inflight.current === after) return Promise.resolve();
    inflight.current = after;
    if (after) setLoadingMore(true);
    const startedAt = epoch.current;
    return listAtlasProposals(3, after)
      .then((r) => {
        if (startedAt !== epoch.current) {
          // hubo una decisión mientras cargaba: esta respuesta es vieja → repetir la consulta
          inflight.current = null;
          return loadRef.current ? loadRef.current(after) : Promise.resolve();
        }
        setError(null);
        setData((prev) => {
          if (!prev) return r;
          // La atención confirmada localmente (p.ej. una aprobación reciente que quedó `approved`/
          // `uncertain`) NO se pierde por lo que traiga el servidor: unión por id. Sólo una
          // relectura individual con estado terminal la retira (replace/remove).
          const known = new Map(prev.attention.map((p) => [p.id, p] as const));
          for (const p of r.attention) known.set(p.id, p);
          const attention = Array.from(known.values());
          if (!after) return { ...r, attention };
          const seen = new Set(prev.proposals.map((p) => p.id));
          return { ...r, attention, proposals: [...prev.proposals, ...r.proposals.filter((p) => !seen.has(p.id))] };
        });
      })
      .catch((e) => {
        if (startedAt !== epoch.current) {
          // el error es de un listado ya obsoleto: se repite, no se muestra
          inflight.current = null;
          return loadRef.current ? loadRef.current(after) : Promise.resolve();
        }
        const msg = e instanceof Error ? e.message : "No pude cargar las propuestas de ATLAS";
        if (after) {
          // fallo al paginar: las tarjetas y la atención ya confirmadas se quedan; sólo se avisa
          toast.error(`No pude cargar más propuestas (${msg})`);
          return;
        }
        setError({ status: e instanceof ApiError ? e.status : 0, message: msg });
      })
      .finally(() => { setLoaded(true); setLoadingMore(false); if (inflight.current === after) inflight.current = null; });
  }, []);

  useEffect(() => {
    loadRef.current = load;
    // fuera del tick del efecto: el linter no quiere setState síncrono dentro de un effect
    const t = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  if (!loaded) return null;
  // 403 = no sos aprobador: la sección no existe para vos. Cualquier otro error sí se muestra,
  // y si ya había datos confirmados en pantalla, el aviso va ARRIBA sin desmontarlos.
  if (error?.status === 403) return null;
  const errorBanner = error ? (
    <Card className="p-4 text-[13px] text-amber-200/90">
      No pude cargar las propuestas de ATLAS ({error.message}).{" "}
      <button className="underline" onClick={() => void load()}>Reintentar</button>
    </Card>
  ) : null;
  if (error && !data) {
    return <section className="pt-6" aria-label="Propuestas de ATLAS">{errorBanner}</section>;
  }
  // La sección sólo desaparece cuando no queda NADA: ni visibles, ni en atención, ni páginas por cargar
  if (!data || (data.proposals.length === 0 && data.attention.length === 0 && !(data.more > 0 && data.next_cursor))) return null;

  const remove = (id: number) => {
    epoch.current += 1;
    setData((prev) => prev ? { ...prev, proposals: prev.proposals.filter((p) => p.id !== id), attention: prev.attention.filter((p) => p.id !== id) } : prev);
  };
  /** Aplica el estado DURABLE leído del servidor: pending se actualiza en su lugar; uncertain/approved
   *  pasan a atención; sólo los estados terminales (executed/failed/rejected/expired) retiran la tarjeta. */
  const replace = (p: AtlasProposal) => {
    epoch.current += 1;
    setData((prev) => {
      if (!prev) return prev;
      const inAttention = p.status === "uncertain" || p.status === "approved";
      const stillPending = p.status === "pending";
      return {
        ...prev,
        proposals: stillPending
          ? prev.proposals.map((x) => (x.id === p.id ? p : x))
          : prev.proposals.filter((x) => x.id !== p.id),
        attention: inAttention ? [p, ...prev.attention.filter((x) => x.id !== p.id)] : prev.attention.filter((x) => x.id !== p.id),
      };
    });
  };

  return (
    <section className="pt-6 space-y-3" aria-label="Propuestas de ATLAS pendientes de aprobación">
      <div className="flex items-center gap-2">
        <Megaphone className="size-4 text-[var(--color-noa)]" />
        <h2 className="text-[15px] font-medium text-white/90">
          {data.proposals.length === 1 ? "1 propuesta de ATLAS" : `${data.proposals.length} propuestas de ATLAS`}
          {data.more > 0 && <span className="text-white/40 font-normal"> · {data.more} más</span>}
        </h2>
      </div>
      <p className="text-[13px] text-white/45 -mt-1">
        Cambios en Google Ads y Meta Ads que ATLAS propone y NO aplica solo. Aprobar ejecuta y verifica; rechazar exige una nota.
      </p>
      {errorBanner}
      {data.attention.length > 0 && (
        <Card className="p-3 text-[13px] text-amber-200/90 space-y-2">
          <div className="font-medium">{data.attention.length} ejecución(es) sin resolver reservan su recurso</div>
          {data.attention.map((p) => (
            <AttentionRow key={p.id} p={p} onDone={replace} onRemove={() => remove(p.id)} />
          ))}
        </Card>
      )}
      {data.proposals.map((p) => (
        <ProposalCard key={p.id} p={p} onResolved={(np) => (np ? replace(np) : remove(p.id))} />
      ))}
      {data.proposals.length === 0 && data.more > 0 && data.next_cursor && (
        <Card className="p-3 text-[13px] text-white/60">Quedan {data.more} propuesta(s) más.</Card>
      )}
      {data.more > 0 && data.next_cursor && (
        <Button variant="ghost" size="sm" disabled={loadingMore} onClick={() => void load(data.next_cursor || "")}>{loadingMore ? "Cargando…" : `Ver ${Math.min(data.more, 3)} más`}</Button>
      )}
    </section>
  );
}

const SEV: Record<string, string> = { CRITICAL: "bg-red-500/20 text-red-200", HIGH: "bg-orange-500/20 text-orange-200", MEDIUM: "bg-yellow-500/20 text-yellow-100", LOW: "bg-white/10 text-white/70" };
const ACTION_ES: Record<string, string> = {
  PAUSE_AD: "Pausar anuncio", PAUSE_ADGROUP: "Pausar grupo", PAUSE_CAMPAIGN: "Pausar campaña",
  SCALE_BUDGET: "Subir presupuesto", REDUCE_BUDGET: "Bajar presupuesto", ADD_NEGATIVE_KEYWORDS: "Agregar negativas",
};

function useSeenWhenShown(id: number, alreadySeen: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const sent = useRef(alreadySeen);
  useEffect(() => {
    if (sent.current || !ref.current) return;
    const el = ref.current;
    const tryMark = (visible: boolean) => {
      if (sent.current || !visible || document.visibilityState !== "visible") return;
      sent.current = true;
      void markAtlasProposalSeen(id).catch(() => { sent.current = false; });
    };
    const io = new IntersectionObserver((entries) => tryMark(entries.some((e) => e.isIntersecting)), { threshold: 0.5 });
    io.observe(el);
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      const r = el.getBoundingClientRect();
      tryMark(r.top < window.innerHeight && r.bottom > 0);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  }, [id]);
  return ref;
}

function describe(p: AtlasProposal): string {
  const pc = p.precondition || {};
  if (p.action_type === "SCALE_BUDGET" || p.action_type === "REDUCE_BUDGET") {
    return `Presupuesto diario $${Number(pc.previous_daily_budget_usd ?? 0).toFixed(2)} → $${Number(pc.new_daily_budget_usd ?? 0).toFixed(2)}`;
  }
  if (p.action_type === "ADD_NEGATIVE_KEYWORDS") {
    return `${(pc.keywords || []).length} negativas ${pc.match_type || "PHRASE"}: ${(pc.keywords || []).slice(0, 6).join(", ")}${(pc.keywords || []).length > 6 ? "…" : ""}`;
  }
  return `Estado actual ${pc.status_before || "activo"} → PAUSED`;
}

function ProposalCard({ p, onResolved }: { p: AtlasProposal; onResolved: (np: AtlasProposal | null) => void }) {
  const [busy, setBusy] = useState<"approve" | "reject" | "refresh" | null>(null);
  // Tras una decisión SIEMPRE se relee el estado durable. Si la relectura falla, la tarjeta queda
  // bloqueada (sólo "Releer"): un POST ambiguo + GET fallido no puede volver a habilitar Aprobar.
  const [stale, setStale] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const ref = useSeenWhenShown(p.id, !!p.seen_at);

  /** Relee y aplica el estado durable. Devuelve true si pudo releer. */
  const refresh = async (): Promise<boolean> => {
    try {
      const np = await getAtlasProposal(p.id);
      setStale(null);
      onResolved(np);
      return true;
    } catch {
      setStale("No pude releer el estado de esta propuesta. Hasta releerla no se puede decidir.");
      return false;
    }
  };

  const approve = async () => {
    if (busy || stale) return;
    setBusy("approve");
    try {
      const r = await approveAtlasProposal(p.id, p.expected_hash);
      if (r.status === "executed") toast.success(`Aplicado y verificado: ${ACTION_ES[p.action_type] || p.action_type}`);
      else if (r.status === "failed") toast.error(`La plataforma rechazó el cambio: ${r.error || ""}`);
      else toast.warning(`Quedó en ${r.status}: ${r.error || "el efecto no se pudo verificar"}. Hay que reconciliar.`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : (e instanceof Error ? e.message : "No se pudo aprobar"));
    } finally {
      // 503 / red / éxito: el estado que manda es el de la fila, no la respuesta del POST
      await refresh();
      setBusy(null);
    }
  };

  const reject = async () => {
    if (busy || stale) return;
    if (note.trim().length < 3) { toast.error("Contame en una línea por qué: ATLAS aprende del rechazo"); return; }
    setBusy("reject");
    try { await rejectAtlasProposal(p.id, note.trim()); toast.success("Propuesta rechazada"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo rechazar"); }
    finally { await refresh(); setBusy(null); }
  };

  const reread = async () => { setBusy("refresh"); await refresh(); setBusy(null); };

  return (
    <div ref={ref}>
      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("mono text-[10px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded", SEV[p.severity || "LOW"])}>{p.severity || "LOW"}</span>
          <span className="mono text-[10px] uppercase tracking-[0.12em] text-white/45">{p.platform === "meta" ? "Meta Ads" : "Google Ads"}</span>
          <span className="text-[14px] font-medium text-white/90">{ACTION_ES[p.action_type] || p.action_type}</span>
          <span className="ml-auto mono text-[11px] text-white/45">~${p.money_at_stake_usd.toFixed(0)} / 7 d</span>
        </div>
        <div className="text-[13px] text-white/80">{p.target_name || p.target_id}</div>
        <div className="text-[13px] text-white/60">{describe(p)}</div>
        <p className="text-[13px] text-white/55">{p.reasoning}</p>
        {p.expected_impact && <p className="text-[12px] text-white/40">Impacto esperado: {p.expected_impact}</p>}
        <button className="text-[12px] text-white/40 flex items-center gap-1" onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />} {open ? "Ocultar detalle" : "Ver métricas"}
        </button>
        {open && <pre className="mono text-[11px] text-white/50 whitespace-pre-wrap break-words">{JSON.stringify(p.snapshot_metrics, null, 1)}</pre>}
        {stale ? (
          <div className="flex items-center gap-2 pt-1 text-[13px] text-amber-200/90">
            <span className="flex-1">{stale}</span>
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void reread()}>
              <RefreshCw className={cn("size-3.5", busy === "refresh" && "animate-spin")} /> Releer
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" disabled={busy !== null} onClick={() => void approve()}>
              <Check className="size-4" /> {busy === "approve" ? "Aplicando…" : "Aprobar"}
            </Button>
            <input
              value={note} onChange={(e) => setNote(e.target.value)} placeholder="Por qué no (para rechazar)"
              className="flex-1 min-w-0 bg-white/5 rounded px-2 py-1 text-[13px] text-white/80 outline-none"
            />
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void reject()}>
              <X className="size-4" /> {busy === "reject" ? "…" : "Rechazar"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function AttentionRow({ p, onDone, onRemove }: { p: AtlasProposal; onDone: (np: AtlasProposal) => void; onRemove: () => void }) {
  const [busy, setBusy] = useState(false);
  const reconcile = async () => {
    setBusy(true);
    try {
      const r = await reconcileAtlasProposal(p.id);
      if (r.ok) { toast.success(`#${p.id} reconciliada: ${r.status}`); onRemove(); }
      else { toast.message(r.error || "Sigue sin resolverse"); try { onDone(await getAtlasProposal(p.id)); } catch { /* se queda como está */ } }
    } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo reconciliar"); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="mono text-[11px] text-amber-200/70">#{p.id}</span>
      <span className="text-white/80">{ACTION_ES[p.action_type] || p.action_type} · {p.target_name || p.target_id}</span>
      <span className="text-white/45">{p.status}{p.exec_state ? ` / ${p.exec_state}` : ""}</span>
      <Button size="sm" variant="ghost" className="ml-auto" disabled={busy} onClick={() => void reconcile()}>
        <RefreshCw className={cn("size-3.5", busy && "animate-spin")} /> Reconciliar
      </Button>
    </div>
  );
}
