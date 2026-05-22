import { Card } from "./Card";

export interface PaymentProposalCardData {
  proposal_id?: string;
  client?: string;
  amount?: number;
  factura?: string;
  evidence?: string;
  evidence_source?: string;
  detected_at?: string;
}

interface PaymentProposalCardProps {
  data: PaymentProposalCardData;
  pending?: boolean;
}

export function PaymentProposalCard({ data, pending }: PaymentProposalCardProps) {
  return (
    <Card title="Pago propuesto" subtitle={data.client} pending={pending}>
      <pre className="text-xs text-white/60 overflow-x-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </Card>
  );
}
