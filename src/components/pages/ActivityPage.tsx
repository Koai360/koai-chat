import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, BellRing, ChevronDown, ChevronUp, Clock, Pause, Play, Repeat, X, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  ApiError,
  cancelNoaWakeup,
  getNoaActivity,
  setRecurringStatus,
  setResponsibilityStatus,
  type NoaActivity,
  type NoaQueuedWakeup,
  type NoaRecurringTask,
  type NoaResponsibility,
  type NoaRun,
  type NoaStatusResult,
} from "@/lib/api";
import { navigate } from "@/lib/routing";
import { Card } from "@/components/cards/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { InlineConfirm } from "@/components/ui/InlineConfirm";
import { describePattern, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * ActivityPage — S356, ADR 0087 F4. Lo que Noa tiene encargado y lo que hizo sola, de UNA persona
 * (el servidor filtra por el dueño del JWT): responsabilidades con sus notas, tareas programadas,
 * despertares en cola y las últimas corridas. Pausar / reanudar / cerrar / cancelar llaman a la
 * misma lógica que las herramientas de Noa en el chat; después de cada acción se relee todo.
 */
export function ActivityPage() {
  const [data, setData] = useState<NoaActivity | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  // Codex F4 PWA r1: si una relectura falla con datos en pantalla, esos datos pueden estar viejos
  // (p.ej. después de una acción que SÍ se aplicó): se avisa y se bloquean los controles hasta releer.
  const [stale, setStale] = useState(false);
  const [reloading, setReloading] = useState(false);
  // Codex F4 PWA r2: cada lectura lleva GENERACIÓN; solo la vigente aplica datos/errores/stale. Una
  // acción sube la generación antes del POST, así ninguna lectura anterior pisa la posterior.
  const gen = useRef(0);

  const load = useCallback(async (): Promise<boolean> => {
    const mine = ++gen.current;
    setReloading(true);
    try {
      const fresh = await getNoaActivity();
      if (mine !== gen.current) return false;
      setData(fresh);
      setError(null);
      setStale(false);
      return true;
    } catch (e) {
      if (mine !== gen.current) return false;
      setError({ status: e instanceof ApiError ? e.status : 0, message: e instanceof Error ? e.message : "error" });
      setStale(true);
      return false;
    } finally {
      if (mine === gen.current) {
        setReloading(false);
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  /** Una acción a la vez; el resultado que se muestra es el del servidor y después se relee. */
  const act = async (key: string, run: () => Promise<NoaStatusResult>) => {
    if (busy || stale) return;
    setBusy(key);
    gen.current += 1;            // invalida cualquier lectura en vuelo iniciada antes de la acción
    try {
      const r = await run();
      if (r.ok) toast.success(r.message.replace(/\*\*/g, "").replace(/`/g, ""));
      else toast.message(r.message.replace(/\*\*/g, "").replace(/`/g, ""));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo aplicar");
    } finally {
      await load();
      setBusy(null);
    }
  };

  const header = (
    <header className="px-6 pt-6 pb-3 max-w-[1180px] w-full flex items-end justify-between gap-4 flex-wrap">
      <div>
        <h1 className="display text-[24px] md:text-[28px] xl:text-[32px] font-semibold text-white mb-1">Actividad</h1>
        <p className="text-sm text-white/45">Lo que Noa vigila por vos y lo que hizo sola.</p>
      </div>
      {data && (
        <div className="flex items-center gap-2 flex-wrap text-[13px]">
          <Pill tone="neutral" leadingIcon={<Activity className="size-3.5" />}>
            Hoy {data.today.runs}/{data.today.cap} revisiones · {data.today.proactive}/{data.today.proactive_cap} proactivas
          </Pill>
          {data.proposals.pending + data.proposals.attention > 0 && (
            <button onClick={() => navigate({ kind: "bandeja" })} className="underline text-[var(--color-noa)]">
              {data.proposals.pending + data.proposals.attention} propuesta(s) esperan tu OK →
            </button>
          )}
        </div>
      )}
    </header>
  );

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        {header}
        <div className="px-6 max-w-[1180px] space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="h-full flex flex-col">
        {header}
        <div className="px-6 max-w-[1180px]">
          <Card className="p-4 text-[13px] text-amber-200/90">
            {error.status === 404
              ? "La vista de Actividad todavía no está habilitada para vos."
              : <>No pude cargar la actividad ({error.message}). <button className="underline" onClick={() => void load()}>Reintentar</button></>}
          </Card>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const live = data.responsibilities.filter((r) => r.status === "active" || r.status === "paused");
  // Controles bloqueados mientras hay una acción en curso o los datos pueden estar viejos.
  const lock = stale ? "stale" : busy;
  const ended = data.responsibilities.filter((r) => r.status !== "active" && r.status !== "paused");

  return (
    <div className="h-full flex flex-col">
      {header}
      <div className="flex-1 overflow-y-auto px-6 pb-10">
        {stale && (
          <Card className="mb-4 max-w-[1180px] p-3 text-[13px] text-amber-200/90 flex items-center gap-2">
            <span className="flex-1">No pude actualizar ({error?.message}). Lo que ves puede estar desactualizado: releé antes de tocar algo.</span>
            <Button size="sm" variant="ghost" disabled={reloading} onClick={() => void load()}>
              {reloading ? "Releyendo…" : "Releer"}
            </Button>
          </Card>
        )}
        <div className="max-w-[1180px] w-full grid gap-6 grid-cols-[minmax(0,1fr)] xl:grid-cols-2 xl:items-start">
          <section className="min-w-0 space-y-3" aria-label="Responsabilidades">
            <SectionTitle icon={<BellRing className="size-4" />} title="Responsabilidades" count={live.length}
                          hint="Lo que le encargaste a Noa para que revise sola." />
            {live.length === 0 && (
              <Card className="p-4 text-[13px] text-white/55">
                Nada encargado. Decile a Noa en el chat «encargate de…» y aparece acá.
              </Card>
            )}
            {live.map((r) => (
              <ResponsibilityCard key={r.id} r={r} busy={lock} onAction={(action, reason) =>
                void act(`resp:${r.id}`, () => setResponsibilityStatus(r.id, action, reason))} />
            ))}
            {ended.length > 0 && <Ended items={ended} />}
          </section>

          <div className="min-w-0 space-y-6">
            <section className="space-y-3" aria-label="Tareas programadas">
              <SectionTitle icon={<Repeat className="size-4" />} title="Tareas programadas" count={data.recurring.length}
                            hint="Lo que Noa hace a una hora fija y te manda." />
              {data.recurring.length === 0 && <Card className="p-4 text-[13px] text-white/55">Ninguna.</Card>}
              {data.recurring.map((t) => (
                <RecurringRow key={t.id} t={t} busy={lock} onAction={(action) =>
                  void act(`rec:${t.id}`, () => setRecurringStatus(t.id, action))} />
              ))}
            </section>

            {data.queued.length > 0 && (
              <section className="space-y-2" aria-label="En cola">
                <SectionTitle icon={<Zap className="size-4" />} title="En cola" count={data.queued.length}
                              hint="Revisiones que Noa va a hacer en los próximos minutos." />
                {data.queued.map((w) => (
                  <QueuedRow key={w.id} w={w} busy={lock} onCancel={() => void act(`wk:${w.id}`, () => cancelNoaWakeup(w.id))} />
                ))}
              </section>
            )}

            <section className="space-y-2" aria-label="Últimas corridas">
              <SectionTitle icon={<Clock className="size-4" />} title="Últimas revisiones" count={data.runs.length}
                            hint="Cada vez que Noa revisó algo sola." />
              {data.runs.length === 0 && <Card className="p-4 text-[13px] text-white/55">Todavía ninguna.</Card>}
              <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
                {data.runs.map((run) => <RunRow key={run.id} run={run} />)}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title, count, hint }: { icon: React.ReactNode; title: string; count: number; hint: string }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-[15px] font-medium text-white/90">
        <span className="text-[var(--color-noa)]">{icon}</span>
        {title}
        <span className="mono text-[11px] text-white/40">{count}</span>
      </h2>
      <p className="text-[12px] text-white/40">{hint}</p>
    </div>
  );
}

const SOURCE_ES: Record<string, string> = {
  pago: "pagos", correo_importante: "correos importantes", escalacion_kira: "dudas de Kira", pedido_atrasado: "pedidos atrasados",
};

function miami(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-US", {
    timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function ResponsibilityCard({ r, busy, onAction }: {
  r: NoaResponsibility; busy: string | null; onAction: (a: "pause" | "resume" | "close", reason?: string) => void;
}) {
  const [showNotes, setShowNotes] = useState(false);
  const [closing, setClosing] = useState(false);
  const isBusy = busy === `resp:${r.id}`;
  const wakes = (r.triggers || []).map((t) => SOURCE_ES[t] || t);
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[14px] font-medium text-white/90">{r.title}</span>
        <Pill tone={r.status === "active" ? "noa" : "warning"}>{r.status === "active" ? "Activa" : "Pausada"}</Pill>
        {r.proactive && <Pill tone="neutral">proactiva</Pill>}
      </div>
      <p className="text-[13px] text-white/65 whitespace-pre-wrap break-words">{r.objective}</p>
      <div className="text-[12px] text-white/45 space-y-0.5">
        {r.schedule_pattern && <div>{describePattern(r.schedule_pattern)} · próxima {r.status === "active" ? miami(r.next_run_at) : "—"}</div>}
        {wakes.length > 0 && <div>Se despierta con: {wakes.join(", ")}</div>}
        <div>Última revisión {r.last_run_at ? relativeTime(r.last_run_at) : "—"} · último aviso {r.last_notified_at ? relativeTime(r.last_notified_at) : "—"}</div>
        {r.status === "paused" && r.paused_reason && <div className="text-amber-200/80">{r.paused_reason}</div>}
        {(r.consecutive_failures || 0) > 0 && <div className="text-amber-200/80">{r.consecutive_failures} revisión(es) fallida(s) seguidas</div>}
      </div>
      {r.notes && (
        <div>
          <button className="text-[12px] text-white/40 flex items-center gap-1" onClick={() => setShowNotes((o) => !o)}>
            {showNotes ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />} Notas de Noa
          </button>
          {showNotes && (
            <div className="mt-1 rounded-md bg-white/[0.04] border border-white/10 px-3 py-2 text-[12px] text-white/70 whitespace-pre-wrap break-words">
              {r.notes}
            </div>
          )}
        </div>
      )}
      {closing ? (
        <InlineConfirm question="¿Cerrar esta responsabilidad? Noa deja de revisarla." confirmLabel="Sí, cerrar"
                       busy={isBusy} onCancel={() => setClosing(false)}
                       onConfirm={() => { setClosing(false); onAction("close"); }} />
      ) : (
        <div className="flex flex-wrap gap-2 pt-1">
          {r.status === "active" ? (
            <Button size="sm" variant="secondary" disabled={busy !== null} leadingIcon={<Pause className="size-4" />}
                    onClick={() => onAction("pause")}>Pausar</Button>
          ) : (
            <Button size="sm" variant="secondary" disabled={busy !== null} leadingIcon={<Play className="size-4" />}
                    onClick={() => onAction("resume")}>Reanudar</Button>
          )}
          <Button size="sm" variant="ghost" disabled={busy !== null} leadingIcon={<X className="size-4" />}
                  onClick={() => setClosing(true)}>Cerrar</Button>
        </div>
      )}
    </Card>
  );
}

function Ended({ items }: { items: NoaResponsibility[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button className="text-[12px] text-white/40 flex items-center gap-1" onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />} Cerradas o vencidas en los últimos 7 días ({items.length})
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {items.map((r) => (
            <div key={r.id} className="text-[12px] text-white/50 flex gap-2">
              <span className="text-white/70">{r.title}</span>
              <span>· {r.status === "closed" ? "cerrada" : "vencida"}</span>
              {r.paused_reason && <span className="truncate">· {r.paused_reason}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecurringRow({ t, busy, onAction }: {
  t: NoaRecurringTask; busy: string | null; onAction: (a: "pause" | "resume" | "cancel") => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  return (
    <Card className="p-3 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[14px] text-white/90">{t.title}</span>
        <Pill tone={t.status === "active" ? "noa" : "warning"}>{t.status === "active" ? "Activa" : "Pausada"}</Pill>
      </div>
      <div className="text-[12px] text-white/45">
        {t.pattern_description || describePattern(t.pattern)}
        {t.status === "active" && <> · próxima {miami(t.next_run_at)}</>}
        {typeof t.run_count === "number" && <> · {t.run_count} {t.run_count === 1 ? "vez" : "veces"}</>}
        {t.last_run_status === "failed" && <span className="text-amber-200/80"> · la última falló</span>}
      </div>
      {cancelling ? (
        <InlineConfirm question="¿Cancelar esta tarea? No se vuelve a ejecutar." confirmLabel="Sí, cancelar"
                       busy={busy === `rec:${t.id}`} onCancel={() => setCancelling(false)}
                       onConfirm={() => { setCancelling(false); onAction("cancel"); }} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {t.status === "active" ? (
            <Button size="sm" variant="secondary" disabled={busy !== null} leadingIcon={<Pause className="size-4" />}
                    onClick={() => onAction("pause")}>Pausar</Button>
          ) : (
            <Button size="sm" variant="secondary" disabled={busy !== null} leadingIcon={<Play className="size-4" />}
                    onClick={() => onAction("resume")}>Reanudar</Button>
          )}
          <Button size="sm" variant="ghost" disabled={busy !== null} leadingIcon={<X className="size-4" />}
                  onClick={() => setCancelling(true)}>Cancelar</Button>
        </div>
      )}
    </Card>
  );
}

const KIND_ES: Record<NoaQueuedWakeup["kind"], string> = { event: "por eventos", schedule: "por horario", proactive: "proactiva" };

function QueuedRow({ w, busy, onCancel }: { w: NoaQueuedWakeup; busy: string | null; onCancel: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] rounded-lg border border-white/[0.06] px-3 py-2">
      <span className="min-w-0 max-w-full text-white/80 truncate">{w.responsibility_title || "Responsabilidad"}</span>
      <span className="text-white/40">· {KIND_ES[w.kind]}{w.events > 0 ? ` (${w.events} evento${w.events === 1 ? "" : "s"})` : ""}</span>
      <span className="ml-auto mono text-[11px] text-white/40 whitespace-nowrap">{miami(w.not_before)}</span>
      {w.kind !== "schedule" && (
        <Button size="sm" variant="ghost" disabled={busy !== null} onClick={onCancel}>
          {busy === `wk:${w.id}` ? "…" : "Cancelar"}
        </Button>
      )}
    </div>
  );
}

const RUN_ES: Record<string, { label: string; tone: string }> = {
  notified: { label: "avisó", tone: "text-[var(--color-noa)]" },
  silent: { label: "sin novedad", tone: "text-white/45" },
  failed: { label: "falló", tone: "text-red-300/80" },
  abandoned: { label: "se cortó", tone: "text-amber-200/80" },
  running: { label: "revisando…", tone: "text-amber-200/80" },
  skipped_cap: { label: "tope del día", tone: "text-white/35" },
  skipped_busy: { label: "ocupada", tone: "text-white/35" },
};
const TRIGGER_ES: Record<NoaRun["trigger"], string> = { schedule: "horario", event: "evento", proactive: "proactiva", manual: "manual" };

function RunRow({ run }: { run: NoaRun }) {
  const st = RUN_ES[run.status] || { label: run.status, tone: "text-white/50" };
  const detail = run.status === "failed" || run.status === "abandoned" ? run.error : run.summary;
  return (
    <div className="px-3 py-2 text-[13px]">
      <div className="flex items-center gap-2 min-w-0">
        <span className="min-w-0 text-white/80 truncate">{run.responsibility_title || "Responsabilidad"}</span>
        <span className="shrink-0 text-white/35 text-[12px]">· {TRIGGER_ES[run.trigger] || run.trigger}</span>
        <span className={cn("ml-auto shrink-0 whitespace-nowrap text-[12px]", st.tone)}>{st.label}</span>
        <span className="shrink-0 mono text-[11px] text-white/35 text-right">{relativeTime(run.started_at)}</span>
      </div>
      {detail && <div className="text-[12px] text-white/50 line-clamp-2 break-words">{detail}</div>}
    </div>
  );
}
