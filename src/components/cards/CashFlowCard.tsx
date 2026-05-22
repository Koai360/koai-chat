import { Card } from "./Card";

export interface CashFlowCardData {
  net?: number;
  inflows?: number;
  outflows?: number;
  burn_daily?: number;
  runway_days?: number;
  sparkline?: number[];
  period?: string;
  forecast_30d?: number;
}

interface CashFlowCardProps {
  data: CashFlowCardData;
  pending?: boolean;
}

export function CashFlowCard({ data, pending }: CashFlowCardProps) {
  return (
    <Card title="CashFlow" subtitle={data.period} pending={pending}>
      <pre className="text-xs text-white/60 overflow-x-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </Card>
  );
}
