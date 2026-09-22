import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PanelRightClose, PanelRightOpen, Inbox, Package, Wallet, Image as ImageIcon, ChevronRight, RefreshCw } from "lucide-react";
import { getPanel, listImages, type PanelData } from "@/lib/api";
import type { ChatImage } from "@/types/api";
import { navigate } from "@/lib/routing";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";

const OPEN_KEY = "noa.panel.open";
const REFRESH_MS = 5 * 60_000;

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}

/**
 * ContextPanel — el gutter derecho del chat, con propósito (S332 F3, decisión de Jesús).
 *
 * A ≥1536px el chat de 720px dejaba más de 500px de negro a la derecha. Ahora ahí vive lo
 * que la persona tiene que mirar HOY, según su rol (las mismas allowlists que los pulsos de
 * Noa, ADR 0054): pedidos vencidos / por entregar / parados para producción, mora para
 * finanzas; el resumen de la Bandeja con las 3 que más esperan; las últimas imágenes.
 * Todo es un atajo a la pantalla completa. Plegable; la preferencia se recuerda.
 */
export function ContextPanel() {
  const [open, setOpen] = useState<boolean>(readOpen);
  const [data, setData] = useState<PanelData | null>(null);
  const [images, setImages] = useState<ChatImage[]>([]);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (force = false) => {
    setRefreshing(true);
    try {
      const [panel, imgs] = await Promise.all([
        getPanel(force),
        listImages({ limit: 6 }).catch(() => ({ items: [] as ChatImage[] })),
      ]);
      setData(panel);
      setImages(imgs.items.slice(0, 6));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void load();
    const t = setInterval(() => void load(), REFRESH_MS);
    const onInbox = () => void load(true);
    window.addEventListener("noa:inbox-changed", onInbox);
    return () => {
      clearInterval(t);
      window.removeEventListener("noa:inbox-changed", onInbox);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(OPEN_KEY, next ? "1" : "0");
    } catch {
      /* preferencia no persistida */
    }
  };

  return (
    <aside
      aria-label="Panel de contexto"
      className={cn(
        "hidden 2xl:flex flex-col h-full shrink-0 border-l border-[var(--color-border)] bg-[var(--color-bg-elevated)]/30 backdrop-blur-xl transition-[width] duration-200",
        open ? "w-[320px]" : "w-[52px]",
      )}
    >
      <div className={cn("flex items-center h-14 shrink-0 px-2", open ? "justify-between pl-4" : "justify-center")}>
        {open && <p className="mono text-[10px] uppercase tracking-[0.12em] text-white/50">Hoy</p>}
        <div className="flex items-center gap-1">
          {open && (
            <button
              onClick={() => void load(true)}
              aria-label="Actualizar"
              title="Actualizar"
              className="size-8 rounded-full flex items-center justify-center text-white/45 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            </button>
          )}
          <button
            onClick={toggle}
            aria-label={open ? "Plegar panel" : "Abrir panel"}
            title={open ? "Plegar panel" : "Abrir panel"}
            className="size-9 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            {open ? <PanelRightClose className="size-[18px]" /> : <PanelRightOpen className="size-[18px]" />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 space-y-6"
          >
            {error && !data && (
              <p className="text-[13px] text-white/50">No pude leer el estado del día. <button onClick={() => void load(true)} className="text-[var(--color-noa)] hover:underline">Reintentar</button></p>
            )}

            {data?.operations && <OperationsBlock ops={data.operations} />}
            {data?.finance && <FinanceBlock fin={data.finance} />}
            {data && <BandejaBlock b={data.bandeja} />}
            {images.length > 0 && <ImagesBlock images={images} />}

            {data && !data.operations && !data.finance && (
              <p className="text-[12px] text-white/40 leading-snug">
                Tu perfil no tiene pulsos de producción ni de cobranza asignados.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}

function BlockTitle({ icon, title, action, onAction }: { icon: React.ReactNode; title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h3 className="flex items-center gap-2 text-[13px] font-medium text-white/85">
        <span className="text-white/50">{icon}</span>
        {title}
      </h3>
      {action && onAction && (
        <button onClick={onAction} className="flex items-center gap-0.5 text-[12px] text-white/45 hover:text-[var(--color-noa)] transition-colors">
          {action}
          <ChevronRight className="size-3" />
        </button>
      )}
    </div>
  );
}

const SHORT_DATE = new Intl.DateTimeFormat("es", { day: "2-digit", month: "short" });
function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  return Number.isNaN(d.getTime()) ? "" : SHORT_DATE.format(d);
}

function OrderList({ items, tone, empty }: { items: { nro: string; entrega?: string | null; estado?: string | null }[]; tone: "danger" | "noa" | "warning" | "neutral"; empty?: string }) {
  if (items.length === 0) return empty ? <p className="text-[12px] text-white/35">{empty}</p> : null;
  const toneCls = {
    danger: "text-[var(--color-danger)]",
    noa: "text-[var(--color-noa)]",
    warning: "text-[var(--color-warning)]",
    neutral: "text-white/60",
  }[tone];
  return (
    <ul className="space-y-1">
      {items.slice(0, 6).map((o) => (
        <li key={o.nro} className="flex items-center gap-2 text-[13px] leading-snug">
          <span className={cn("mono text-[12px] shrink-0", toneCls)}>{o.nro}</span>
          <span className="flex-1 min-w-0 truncate text-white/60">{o.estado ?? ""}</span>
          {o.entrega && <span className="mono text-[11px] text-white/40 shrink-0 tabular-nums">{fmtDate(o.entrega)}</span>}
        </li>
      ))}
      {items.length > 6 && <li className="text-[12px] text-white/35">y {items.length - 6} más</li>}
    </ul>
  );
}

function OperationsBlock({ ops }: { ops: NonNullable<PanelData["operations"]> }) {
  const nada = ops.vencidos.length === 0 && ops.proximos.length === 0 && ops.bloqueados.length === 0 && ops.en_hold.length === 0;
  return (
    <section>
      <BlockTitle icon={<Package className="size-4" />} title="Producción" />
      {nada && <p className="text-[12px] text-white/40">Sin pedidos vencidos ni por entregar en {ops.ventana_dias} días. {ops.activos} activos.</p>}
      {ops.vencidos.length > 0 && (
        <div className="mb-3">
          <p className="mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-danger)]/80 mb-1">Vencidos · {ops.vencidos.length}</p>
          <OrderList items={ops.vencidos} tone="danger" />
        </div>
      )}
      {ops.proximos.length > 0 && (
        <div className="mb-3">
          <p className="mono text-[10px] uppercase tracking-[0.12em] text-white/45 mb-1">Por entregar en {ops.ventana_dias} días · {ops.proximos.length}</p>
          <OrderList items={ops.proximos} tone="noa" />
        </div>
      )}
      {(ops.bloqueados.length > 0 || ops.en_hold.length > 0) && (
        <div>
          <p className="mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-warning)]/80 mb-1">Parados · {ops.bloqueados.length + ops.en_hold.length}</p>
          <OrderList items={[...ops.bloqueados, ...ops.en_hold.map((h) => ({ ...h, estado: `hold · ${h.estado ?? ""}` }))]} tone="warning" />
        </div>
      )}
    </section>
  );
}

function FinanceBlock({ fin }: { fin: NonNullable<PanelData["finance"]> }) {
  return (
    <section>
      <BlockTitle icon={<Wallet className="size-4" />} title="Cobranza" />
      {fin.mora_count === 0 ? (
        <p className="text-[12px] text-white/40">Nada vencido hace más de {fin.mora_dias} días.</p>
      ) : (
        <div className="rounded-xl border border-[var(--color-warning)]/25 bg-[var(--color-warning)]/8 px-3 py-2.5">
          <p className="display text-[22px] font-semibold text-white tabular-nums leading-none">{formatMoney(fin.mora_total)}</p>
          <p className="mt-1 text-[12px] text-white/60">
            {fin.mora_count} factura{fin.mora_count !== 1 ? "s" : ""} vencida{fin.mora_count !== 1 ? "s" : ""} hace más de {fin.mora_dias} días
          </p>
        </div>
      )}
      {fin.merchants_sin_categorizar ? (
        <p className="mt-2 text-[12px] text-white/50">{fin.merchants_sin_categorizar} merchant{fin.merchants_sin_categorizar !== 1 ? "s" : ""} nuevo{fin.merchants_sin_categorizar !== 1 ? "s" : ""} sin categorizar</p>
      ) : null}
    </section>
  );
}

function BandejaBlock({ b }: { b: PanelData["bandeja"] }) {
  const go = () => navigate({ kind: "bandeja" });
  return (
    <section>
      <BlockTitle icon={<Inbox className="size-4" />} title={b.count ? `Bandeja · ${b.count}` : "Bandeja"} action="Abrir" onAction={go} />
      {b.count === 0 || b.count === null ? (
        <p className="text-[12px] text-white/40">{b.count === 0 ? "Al día: Kira no espera nada." : "Sin dato."}</p>
      ) : (
        <>
          <p className="text-[12px] text-white/45 mb-2">
            {[b.quote ? `${b.quote} con quote` : null, b.pedido ? `${b.pedido} con pedido` : null, b.nuevo ? `${b.nuevo} sin cotizar` : null].filter(Boolean).join(" · ")}
          </p>
          <ul className="space-y-1">
            {b.top.map((t) => (
              <li key={t.id}>
                <button onClick={go} className="w-full text-left rounded-lg px-2 py-1.5 -mx-2 hover:bg-white/[0.04] transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 truncate text-[13px] text-white/85">{t.contact_name}</span>
                    <span className="mono text-[10px] text-white/40 shrink-0">{t.waiting.replace(/^hace\s/, "")}</span>
                  </div>
                  <p className="text-[12px] text-white/45 leading-snug line-clamp-1">{t.question.replace(/^💰\s*/, "")}</p>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function ImagesBlock({ images }: { images: ChatImage[] }) {
  return (
    <section>
      <BlockTitle icon={<ImageIcon className="size-4" />} title="Últimas imágenes" action="Galería" onAction={() => navigate({ kind: "galeria" })} />
      <div className="grid grid-cols-3 gap-1.5">
        {images.map((img) => (
          <button
            key={img.id}
            onClick={() => navigate({ kind: "galeria" })}
            className="aspect-square rounded-lg overflow-hidden bg-white/[0.04] hover:ring-1 hover:ring-[var(--color-noa)]/50 transition"
            aria-label={img.prompt ? `Imagen: ${img.prompt.slice(0, 60)}` : "Imagen"}
          >
            <img src={img.url} alt="" loading="lazy" className="size-full object-cover" />
          </button>
        ))}
      </div>
    </section>
  );
}
