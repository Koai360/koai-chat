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
import { RecurringTaskCard } from "@/components/cards/RecurringTaskCard";
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
      return <RecurringTaskCard data={card.data as never} pending={card.pending} />;
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
