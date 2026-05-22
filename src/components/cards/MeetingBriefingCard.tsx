import { Card } from "./Card";

export interface MeetingBriefingCardData {
  client?: string;
  time?: string;
  in_minutes?: number;
  kpis?: Array<{ label: string; value: string }>;
  last_message?: string;
  open_orders?: number;
  top_memories?: string[];
}

interface MeetingBriefingCardProps {
  data: MeetingBriefingCardData;
  pending?: boolean;
}

export function MeetingBriefingCard({ data, pending }: MeetingBriefingCardProps) {
  return (
    <Card title="Briefing meeting" subtitle={data.client} pending={pending}>
      <pre className="text-xs text-white/60 overflow-x-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </Card>
  );
}
