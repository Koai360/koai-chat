import { Card } from "./Card";

export interface Client360CardData {
  client?: string;
  business?: string;
  status?: string;
  mrr?: number;
  ltv?: number;
  invoices_count?: number;
  open_orders?: number;
  plaid_payments?: number;
  last_interaction?: string;
}

interface Client360CardProps {
  data: Client360CardData;
  pending?: boolean;
}

export function Client360Card({ data, pending }: Client360CardProps) {
  return (
    <Card title="Cliente 360" subtitle={data.client} pending={pending}>
      <pre className="text-xs text-white/60 overflow-x-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </Card>
  );
}
