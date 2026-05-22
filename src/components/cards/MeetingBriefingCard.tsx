import { useState } from "react";
import { Calendar, Clock, ChevronRight } from "lucide-react";
import { Card } from "./Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";

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

type SectionKey = "kpis" | "last_message" | "orders" | "memories";

export function MeetingBriefingCard({ data, pending }: MeetingBriefingCardProps) {
  const [open, setOpen] = useState<Set<SectionKey>>(new Set());
  const toggle = (k: SectionKey) =>
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <Card
      title="Briefing pre-reunión"
      subtitle={data.client}
      icon={<Calendar className="size-[18px] text-[var(--color-noa)]" />}
      pending={pending}
    >
      <div className="space-y-3">
        {(data.time || data.in_minutes !== undefined) && (
          <div className="flex items-center gap-2">
            <Pill tone="noa" leadingIcon={<Clock className="size-3" />}>
              {data.in_minutes !== undefined
                ? `En ${data.in_minutes} min`
                : data.time}
            </Pill>
          </div>
        )}

        {data.kpis && data.kpis.length > 0 && (
          <Section
            label="KPIs cliente"
            open={open.has("kpis")}
            onToggle={() => toggle("kpis")}
          >
            <div className="grid grid-cols-2 gap-2 mt-2">
              {data.kpis.map((kpi, i) => (
                <div key={i} className="bg-white/[0.03] rounded-lg p-2">
                  <p className="text-xs text-white/45">{kpi.label}</p>
                  <p className="mono text-[14px] text-white/95 font-medium">{kpi.value}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {data.last_message && (
          <Section
            label="Último mensaje"
            open={open.has("last_message")}
            onToggle={() => toggle("last_message")}
          >
            <p className="text-[13px] text-white/80 mt-2 leading-relaxed italic">
              "{data.last_message}"
            </p>
          </Section>
        )}

        {data.open_orders !== undefined && data.open_orders > 0 && (
          <Section
            label={`Pedidos abiertos (${data.open_orders})`}
            open={open.has("orders")}
            onToggle={() => toggle("orders")}
          >
            <p className="text-[13px] text-white/55 mt-2">
              {data.open_orders} pedido{data.open_orders > 1 ? "s" : ""} en producción.
            </p>
          </Section>
        )}

        {data.top_memories && data.top_memories.length > 0 && (
          <Section
            label={`Memorias relevantes (${data.top_memories.length})`}
            open={open.has("memories")}
            onToggle={() => toggle("memories")}
          >
            <ul className="space-y-1.5 mt-2">
              {data.top_memories.map((m, i) => (
                <li key={i} className="text-[13px] text-white/80 leading-relaxed">
                  · {m}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      <div className="px-5 pb-4 pt-1 -mx-5">
        <Button variant="secondary" size="sm" className="ml-5">
          Abrir briefing completo →
        </Button>
      </div>
    </Card>
  );
}

function Section({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-white/[0.04] pt-2.5 first:border-t-0 first:pt-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left text-[14px] text-white/85 hover:text-white transition"
      >
        <span className="font-medium">{label}</span>
        <ChevronRight
          className={cn("size-4 text-white/45 transition-transform", open && "rotate-90")}
        />
      </button>
      {open && <div className="overflow-hidden">{children}</div>}
    </div>
  );
}
