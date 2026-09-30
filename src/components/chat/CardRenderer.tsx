import { useState } from "react";
import { toast } from "sonner";
import type { ParsedCard } from "@/lib/cards";

/**
 * CardRenderer — dispatch al tipo correcto de card inline.
 *
 * Fase 4 implementará los 8 tipos. Por ahora, fallback genérico que muestra
 * el data como JSON colapsable para que el desarrollo no se rompa.
 */

import { CashFlowCard } from "@/components/cards/CashFlowCard";
import { DraftEmailCard } from "@/components/cards/DraftEmailCard";
import { PaymentProposalCard } from "@/components/cards/PaymentProposalCard";
import { MeetingBriefingCard } from "@/components/cards/MeetingBriefingCard";
import { Client360Card } from "@/components/cards/Client360Card";
import { AtRiskClientsCard } from "@/components/cards/AtRiskClientsCard";
import { RecurringTaskCard, type RecurringTaskCardData } from "@/components/cards/RecurringTaskCard";
import { InlineConfirm } from "@/components/ui/InlineConfirm";
import { ApiError, getRecurringTask, setRecurringStatus } from "@/lib/api";
import { AnomalyCard } from "@/components/cards/AnomalyCard";
import { Card } from "@/components/cards/Card";

interface CardRendererProps {
  card: ParsedCard;
}

export function CardRenderer({ card }: CardRendererProps) {
  switch (card.type) {
    case "cashflow":
      return <CashFlowCard data={card.data as never} pending={card.pending} />;
    case "draft_email":
      return <DraftEmailCard data={card.data as never} pending={card.pending} />;
    case "payment_proposal":
      return <PaymentProposalCard data={card.data as never} pending={card.pending} />;
    case "meeting_briefing":
      return <MeetingBriefingCard data={card.data as never} pending={card.pending} />;
    case "client_360":
      return <Client360Card data={card.data as never} pending={card.pending} />;
    case "at_risk_clients":
      return <AtRiskClientsCard data={card.data as never} pending={card.pending} />;
    case "recurring_tasks":
      return <RecurringTaskCardLive data={card.data as RecurringTaskCardData} pending={card.pending} />;
    case "anomalies":
      return <AnomalyCard data={card.data as never} pending={card.pending} />;
    default:
      return (
        <Card title={`Card · ${card.type}`} subtitle="tipo no reconocido aún">
          <pre className="text-xs text-white/60 overflow-x-auto">
            {JSON.stringify(card.data, null, 2)}
          </pre>
        </Card>
      );
  }
}

/**
 * S356 (ADR 0087 F4): los botones de la tarjeta de recurrentes ahora hacen algo. La tarjeta la
 * escribe el MODELO: su id y su título no son confiables (Codex F4 PWA r1). Por eso cada acción
 * primero LEE la tarea real (el servidor solo devuelve tareas del dueño del JWT) y la confirmación
 * muestra SU título y estado; recién ahí se actúa. El estado que queda en la tarjeta es el que
 * devuelve el servidor, también cuando la acción no aplica (409).
 */
type RecAction = "pause" | "resume" | "cancel";
const REC_VERB: Record<RecAction, string> = { pause: "Pausar", resume: "Reanudar", cancel: "Cancelar" };
const REC_STATUS_ES: Record<string, string> = { active: "activa", paused: "pausada", cancelled: "cancelada" };

function RecurringTaskCardLive({ data, pending }: { data: RecurringTaskCardData; pending?: boolean }) {
  const [status, setStatus] = useState(data.status);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ action: RecAction; title: string; status: string } | null>(null);
  const id = data.task_id || "";

  const prepare = async (action: RecAction) => {
    if (busy) return;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      toast.message("Esta tarjeta no trae el id completo de la tarea: usá la página Actividad.");
      return;
    }
    setBusy(true);
    try {
      const real = await getRecurringTask(id);
      setStatus(real.status);
      setConfirm({ action, title: real.title, status: real.status });
    } catch (e) {
      toast.error(e instanceof ApiError && e.status === 404
        ? "No encuentro esa tarea entre las tuyas: no hago nada."
        : `No pude leer la tarea (${e instanceof Error ? e.message : "error"}): no hago nada.`);
    } finally {
      setBusy(false);
    }
  };

  const run = async (action: RecAction) => {
    setConfirm(null);
    setBusy(true);
    try {
      const r = await setRecurringStatus(id, action);
      if (r.task?.status) setStatus(r.task.status as RecurringTaskCardData["status"]);
      const title = r.task?.title ? `«${r.task.title}»` : "la tarea";
      if (r.ok) toast.success(action === "pause" ? `Pausé ${title}` : action === "resume" ? `Reanudé ${title}` : `Cancelé ${title}`);
      else toast.message(r.message.replace(/\*\*/g, "").replace(/`/g, ""));
    } catch (e) {
      toast.error(`No sé cómo terminó (${e instanceof Error ? e.message : "error"}). Revisalo en Actividad.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <RecurringTaskCard
        data={{ ...data, status }}
        pending={pending || busy}
        onPause={() => void prepare("pause")}
        onResume={() => void prepare("resume")}
        onCancel={() => void prepare("cancel")}
      />
      {confirm && (
        <InlineConfirm
          question={`¿${REC_VERB[confirm.action]} «${confirm.title}»? (hoy está ${REC_STATUS_ES[confirm.status] || confirm.status})`}
          confirmLabel={`Sí, ${REC_VERB[confirm.action].toLowerCase()}`}
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void run(confirm.action)}
        />
      )}
    </div>
  );
}
