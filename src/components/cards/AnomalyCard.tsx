import { Card } from "./Card";

export interface AnomalyCardData {
  merchant?: string;
  amount?: number;
  avg_amount?: number;
  detected_at?: string;
  account?: string;
}

interface AnomalyCardProps {
  data: AnomalyCardData;
  pending?: boolean;
}

export function AnomalyCard({ data, pending }: AnomalyCardProps) {
  return (
    <Card title="Anomalía detectada" subtitle={data.merchant} pending={pending}>
      <pre className="text-xs text-white/60 overflow-x-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </Card>
  );
}
