import { useEffect, useState } from "react";
import { GraduationCap, Check, X } from "lucide-react";
import { toast } from "sonner";
import { approveKiraLearning, listKiraLearnings, rejectKiraLearning, type KiraLearning } from "@/lib/api";
import { Card } from "@/components/cards/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * Lecciones de Kira — lo que destiló de una escalación que el equipo respondió
 * directo (F1b) o de una venta, y que espera el OK humano antes de entrar al prompt.
 * Una lección aprobada se inyecta en TODAS las conversaciones siguientes: por eso
 * el gate es una persona (gobernanza S109) y vive acá, en la misma Bandeja.
 */
const CATEGORY_LABEL: Record<string, string> = {
  respuesta_equipo_venta: "venta",
  respuesta_equipo_politica: "política",
  respuesta_equipo_producto: "producto",
  que_funciono: "funcionó",
  que_no_funciono: "no funcionó",
  objecion_superada: "objeción",
  patron_cliente: "patrón",
  tecnica_exitosa: "técnica",
};

export function KiraLearningsSection() {
  const [items, setItems] = useState<KiraLearning[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    listKiraLearnings("pending")
      .then((r) => { if (alive) setItems(r.learnings); })
      .catch(() => { /* silencioso: la sección sólo aparece si hay lecciones */ })
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  if (!loaded || items.length === 0) return null;

  const remove = (id: number) => setItems((prev) => prev.filter((l) => l.id !== id));

  return (
    <section className="pt-6 space-y-3" aria-label="Lecciones de Kira pendientes de aprobación">
      <div className="flex items-center gap-2">
        <GraduationCap className="size-4 text-[var(--color-noa)]" />
        <h2 className="text-[15px] font-medium text-white/90">
          {items.length === 1 ? "1 lección que Kira aprendió" : `${items.length} lecciones que Kira aprendió`}
        </h2>
      </div>
      <p className="text-[13px] text-white/45 -mt-1">
        Si la aprobás, Kira la aplica en todas las conversaciones. Si está mal o es un caso puntual, rechazala.
      </p>
      {items.map((l) => (
        <LearningCard key={l.id} l={l} onDone={() => remove(l.id)} />
      ))}
    </section>
  );
}

function LearningCard({ l, onDone }: { l: KiraLearning; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const label = CATEGORY_LABEL[l.category] || l.category.replace(/_/g, " ");

  const act = async (kind: "approve" | "reject") => {
    if (busy) return;
    setBusy(true);
    try {
      if (kind === "approve") {
        await approveKiraLearning(l.id);
        toast.success("Lección aprobada — Kira ya la aplica ✅");
      } else {
        await rejectKiraLearning(l.id, "rechazada desde la Bandeja");
        toast("Lección rechazada.");
      }
      onDone();
    } catch {
      toast.error("No se pudo guardar. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--color-noa)]/15 text-[var(--color-noa)]">
          {label}
        </span>
        {l.created_at && (
          <span className="text-[11px] text-white/35">
            {new Date(l.created_at).toLocaleDateString("es", { day: "numeric", month: "short" })}
          </span>
        )}
      </div>
      <p className="text-[15px] text-white leading-snug">{l.lesson}</p>
      {l.context && (
        <p className="text-[13px] text-white/45 leading-snug line-clamp-3">{l.context}</p>
      )}
      <div className={cn("flex items-center gap-2 flex-wrap", busy && "opacity-60")}>
        <Button leadingIcon={<Check className="size-4" />} onClick={() => act("approve")} disabled={busy}>
          Aprobar
        </Button>
        <Button variant="ghost" leadingIcon={<X className="size-4" />} onClick={() => act("reject")} disabled={busy}>
          Rechazar
        </Button>
      </div>
    </Card>
  );
}
