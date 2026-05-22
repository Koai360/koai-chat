import { AlertTriangle, Clock } from "lucide-react";
import { Card } from "./Card";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/format";

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
  const clients = data.clients || [];
  const visible = clients.slice(0, 5);
  const remaining = clients.length - visible.length;

  return (
    <Card
      title={`${data.count ?? clients.length} clientes en riesgo`}
      subtitle="Recurring que pararon de pagar o interactuar"
      icon={<AlertTriangle className="size-[18px] text-[var(--color-warning)]" />}
      pending={pending}
    >
      <div className="space-y-1">
        {visible.length === 0 ? (
          <p className="text-sm text-white/55 py-2">Sin clientes en riesgo detectados ahora.</p>
        ) : (
          visible.map((c, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 px-2.5 rounded-lg hover:bg-white/[0.03] transition cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-white font-medium truncate">{c.client}</p>
                <div className="flex items-center gap-3 mt-0.5 text-[12px] text-white/55">
                  {c.mrr !== undefined && (
                    <span className="mono">MRR {formatMoney(c.mrr)}</span>
                  )}
                  {c.ltv !== undefined && (
                    <span className="mono">LTV {formatMoney(c.ltv)}</span>
                  )}
                </div>
              </div>
              {c.silent_days !== undefined && (
                <div className="flex items-center gap-1 text-[var(--color-warning)] text-[12px] shrink-0">
                  <Clock className="size-3" />
                  <span className="mono">{c.silent_days}d</span>
                </div>
              )}
            </div>
          ))
        )}
        {remaining > 0 && (
          <p className="text-xs text-white/45 px-2.5 pt-2">
            + {remaining} más
          </p>
        )}
      </div>

      <div className="px-5 pb-4 pt-1 flex flex-wrap gap-2 -mx-5">
        <Button variant="secondary" size="sm" className="ml-5">
          Ver todos →
        </Button>
        <Button variant="ghost" size="sm">
          Contactar todos
        </Button>
      </div>
    </Card>
  );
}
