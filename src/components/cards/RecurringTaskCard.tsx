import { Card } from "./Card";

export interface RecurringTaskCardData {
  task_id?: string;
  title?: string;
  pattern?: string;
  next_run_at?: string;
  run_count?: number;
  status?: "active" | "paused" | "cancelled";
}

interface RecurringTaskCardProps {
  data: RecurringTaskCardData;
  pending?: boolean;
}

export function RecurringTaskCard({ data, pending }: RecurringTaskCardProps) {
  return (
    <Card title="Tarea recurrente" subtitle={data.title} pending={pending}>
      <pre className="text-xs text-white/60 overflow-x-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </Card>
  );
}
