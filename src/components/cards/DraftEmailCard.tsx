import { Card } from "./Card";

export interface DraftEmailCardData {
  draft_id?: string;
  to?: string;
  subject?: string;
  body?: string;
  preview?: string;
  thread_id?: string;
}

interface DraftEmailCardProps {
  data: DraftEmailCardData;
  pending?: boolean;
}

export function DraftEmailCard({ data, pending }: DraftEmailCardProps) {
  return (
    <Card title="Draft de email" subtitle={data.to} pending={pending}>
      <pre className="text-xs text-white/60 overflow-x-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </Card>
  );
}
