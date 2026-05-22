import { Card } from "./Card";

export interface AtRiskClient {
  client?: string;
  mrr?: number;
  ltv?: number;
  silent_days?: number;
}

export interface AtRiskClientsCardData {
  count?: number;
  clients?: AtRiskClient[];
}

interface AtRiskClientsCardProps {
  data: AtRiskClientsCardData;
  pending?: boolean;
}

export function AtRiskClientsCard({ data, pending }: AtRiskClientsCardProps) {
  return (
    <Card
      title="Clientes en riesgo"
      subtitle={data.count ? `${data.count} clientes` : undefined}
      pending={pending}
    >
      <pre className="text-xs text-white/60 overflow-x-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </Card>
  );
}
