import { useEffect, useState } from "react";
import { BookOpen, Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { toast } from "sonner";
import {
  approveSkillProposal,
  listSkillProposals,
  rejectSkillProposal,
  type SkillProposal,
} from "@/lib/api";
import { Card } from "@/components/cards/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * Skills propuestas por Noa (S308) — procedimientos que Noa destiló de una
 * conversación (o correcciones a una skill existente) y que esperan el OK humano.
 * Una skill aprobada se carga en TODAS las conversaciones siguientes cuando la
 * tarea coincide: por eso el gate es una persona, igual que las lecciones de Kira.
 * Aprobar manda el `body_sha` que se mostró: si el cuerpo cambió en el medio, el
 * servidor rechaza (nadie aprueba algo que no vio).
 */
export function SkillProposalsSection() {
  const [items, setItems] = useState<SkillProposal[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    listSkillProposals("pending")
      .then((r) => { if (alive) setItems(r.skills); })
      .catch(() => { /* silencioso: la sección sólo aparece si hay propuestas */ })
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  if (!loaded || items.length === 0) return null;

  const remove = (id: string) => setItems((prev) => prev.filter((s) => s.id !== id));

  return (
    <section className="pt-6 space-y-3" aria-label="Skills propuestas pendientes de aprobación">
      <div className="flex items-center gap-2">
        <BookOpen className="size-4 text-[var(--color-noa)]" />
        <h2 className="text-[15px] font-medium text-white/90">
          {items.length === 1 ? "1 skill que Noa propone" : `${items.length} skills que Noa propone`}
        </h2>
      </div>
      <p className="text-[13px] text-white/45 -mt-1">
        Si la aprobás, Noa la carga cada vez que la tarea coincida. Si está mal o es un caso puntual, rechazala con una nota: Noa no vuelve a proponer lo mismo.
      </p>
      {items.map((s) => (
        <SkillCard key={s.id} s={s} onDone={() => remove(s.id)} />
      ))}
    </section>
  );
}

function SkillCard({ s, onDone }: { s: SkillProposal; onDone: () => void }) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const isEdit = !!s.replaces_id;

  const approve = async () => {
    setBusy("approve");
    try {
      await approveSkillProposal(s.id, s.body_sha);
      toast.success(`Skill «${s.name}» aprobada`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo aprobar");
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    if (note.trim().length < 3) {
      toast.error("Contame en una línea por qué, así Noa no la vuelve a proponer");
      return;
    }
    setBusy("reject");
    try {
      await rejectSkillProposal(s.id, note.trim());
      toast.success("Propuesta rechazada");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo rechazar");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-wide text-white/40">
              {isEdit ? "corrección" : "nueva"} · {s.agent}
            </span>
            <span className="font-mono text-[13px] text-white/85">{s.name}</span>
          </div>
          <p className="text-[14px] text-white/85 mt-1">{s.description}</p>
          {s.reason && (
            <p className="text-[12px] text-white/45 mt-1">Por qué: {s.reason}</p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[12px] text-white/55 hover:text-white/80"
        aria-expanded={open}
      >
        {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        {open ? "Ocultar procedimiento" : "Ver procedimiento completo"}
      </button>
      {open && (
        <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-white/75 bg-white/5 rounded-lg p-3 max-h-80 overflow-auto">
          {s.body}
        </pre>
      )}
      <div className="flex items-center gap-2 pt-1">
        <Button leadingIcon={<Check className="size-4" />} onClick={approve} disabled={busy !== null} className={cn(busy === "approve" && "opacity-60")}>
          Aprobar
        </Button>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Motivo del rechazo (obligatorio)"
          className="flex-1 min-w-0 bg-white/5 rounded-md px-2 py-1.5 text-[12px] text-white/85 placeholder:text-white/30 outline-none"
        />
        <Button variant="ghost" leadingIcon={<X className="size-4" />} onClick={reject} disabled={busy !== null}>
          Rechazar
        </Button>
      </div>
    </Card>
  );
}
