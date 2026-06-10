import { AlertOctagon, Search, Check } from "lucide-react";
import { Card } from "./Card";
import { Button } from "@/components/ui/Button";
import { formatMoney, formatMiamiTime } from "@/lib/format";

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
  onInvestigate?: () => void;
  onDismiss?: () => void;
}

export function AnomalyCard({ data, pending, onInvestigate, onDismiss }: AnomalyCardProps) {
  const multiplier =
    data.amount && data.avg_amount && data.avg_amount > 0
      ? data.amount / data.avg_amount
      : null;

  return (
    <Card
      title="Anomalía detectada"
      subtitle={data.merchant}
      icon={<AlertOctagon className="size-[18px] text-[var(--color-danger)]" />}
      pending={pending}
    >
      <div className="space-y-3">
        <div>
          <p className="text-xs text-white/55">Monto</p>
          <p className="mono text-[22px] text-[var(--color-danger)] font-medium leading-none">
            {formatMoney(data.amount)}
          </p>
          {data.avg_amount !== undefined && (
            <p className="text-[13px] text-white/55 mt-1">
              vs avg <span className="mono text-white/75">{formatMoney(data.avg_amount)}</span>
              {multiplier && multiplier > 1 && (
                <span className="ml-2 text-[var(--color-warning)]">
                  ({multiplier.toFixed(1)}× sobre promedio)
                </span>
              )}
            </p>
          )}
        </div>

        <div className="space-y-1 text-[14px] pt-2 border-t border-white/[0.04]">
          {data.account && <Row label="Cuenta" value={data.account} />}
          {data.detected_at && (
            <Row label="Detectado" value={formatMiamiTime(data.detected_at)} />
          )}
        </div>
      </div>

      <div className="pt-3 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"

          leadingIcon={<Search className="size-4" />}
          onClick={onInvestigate}
        >
          Investigar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<Check className="size-4" />}
          onClick={onDismiss}
        >
          Marcar OK
        </Button>
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-white/55 w-20 shrink-0 text-[13px]">{label}:</span>
      <span className="text-white/90 text-[13px]">{value}</span>
    </div>
  );
}
