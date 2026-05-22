import { Repeat, Pause, Play, X } from "lucide-react";
import { Card } from "./Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";

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
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onCancel?: (id: string) => void;
}

function describePattern(pattern: string | undefined): string {
  if (!pattern) return "";
  if (pattern.startsWith("daily_")) {
    const hhmm = pattern.slice(6);
    const hh = hhmm.slice(0, 2);
    const mm = hhmm.slice(2, 4);
    return `Cada día a las ${hh}:${mm}`;
  }
  if (pattern.startsWith("weekly_")) {
    const parts = pattern.split("_");
    return `Cada ${parts[1]} a las ${parts[2]?.slice(0, 2)}:${parts[2]?.slice(2, 4)}`;
  }
  if (pattern.startsWith("monthly_")) {
    const parts = pattern.split("_");
    return `Día ${parts[1]} de cada mes a las ${parts[2]?.slice(0, 2)}:${parts[2]?.slice(2, 4)}`;
  }
  if (pattern.startsWith("every_") && pattern.endsWith("h")) {
    const n = pattern.slice(6, -1);
    return `Cada ${n} hora${n !== "1" ? "s" : ""}`;
  }
  if (pattern.startsWith("every_") && pattern.endsWith("min")) {
    const n = pattern.slice(6, -3);
    return `Cada ${n} minuto${n !== "1" ? "s" : ""}`;
  }
  return pattern;
}

export function RecurringTaskCard({
  data,
  pending,
  onPause,
  onResume,
  onCancel,
}: RecurringTaskCardProps) {
  const id = data.task_id || "";
  const status = data.status || "active";
  const description = describePattern(data.pattern);

  return (
    <Card
      title={data.title || "Tarea recurrente"}
      subtitle={description}
      icon={<Repeat className="size-[18px] text-[var(--color-noa)]" />}
      pending={pending}
    >
      <div className="space-y-2 text-[14px]">
        <Pill
          tone={status === "active" ? "noa" : status === "paused" ? "warning" : "neutral"}
        >
          {status === "active" ? "Activa" : status === "paused" ? "Pausada" : "Cancelada"}
        </Pill>

        {data.next_run_at && status === "active" && (
          <div className="text-white/65">
            Próxima ejecución:{" "}
            <span className="mono text-white/85">
              {new Date(data.next_run_at).toLocaleString("es-US", {
                timeZone: "America/New_York",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </span>
          </div>
        )}

        {data.run_count !== undefined && (
          <div className="text-white/55 text-[13px]">
            Ejecutada{" "}
            <span className="mono text-white/75">{data.run_count}</span>{" "}
            {data.run_count === 1 ? "vez" : "veces"}
          </div>
        )}
      </div>

      <div className="px-5 pb-4 pt-1 flex flex-wrap gap-2 -mx-5">
        {status === "active" && (
          <Button
            variant="secondary"
            size="sm"
            className="ml-5"
            leadingIcon={<Pause className="size-4" />}
            onClick={() => onPause?.(id)}
          >
            Pausar
          </Button>
        )}
        {status === "paused" && (
          <Button
            variant="secondary"
            size="sm"
            className="ml-5"
            leadingIcon={<Play className="size-4" />}
            onClick={() => onResume?.(id)}
          >
            Reanudar
          </Button>
        )}
        {status !== "cancelled" && (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<X className="size-4" />}
            onClick={() => onCancel?.(id)}
            className={status === "active" ? "" : "ml-5"}
          >
            Cancelar
          </Button>
        )}
      </div>
    </Card>
  );
}
