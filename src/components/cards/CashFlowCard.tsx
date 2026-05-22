import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "./Card";
import { Sparkline } from "./Sparkline";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";

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
  const net = data.net ?? 0;
  const positive = net >= 0;
  const period = data.period || "Hoy";

  return (
    <Card
      title="Cash flow"
      subtitle={period}
      icon={<Wallet className="size-[18px] text-[var(--color-noa)]" />}
      pending={pending}
    >
      <div className="space-y-4">
        {/* Net + sparkline */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs text-white/45 mb-1">Net</p>
            <p
              className={cn(
                "mono text-[28px] font-medium leading-none",
                positive ? "text-[var(--color-noa)]" : "text-[var(--color-danger)]",
              )}
            >
              {formatMoney(net, { sign: true })}
            </p>
          </div>
          {data.sparkline && data.sparkline.length >= 2 && (
            <Sparkline
              values={data.sparkline}
              width={140}
              height={42}
              color={positive ? "var(--color-noa)" : "var(--color-danger)"}
              className="opacity-90"
            />
          )}
        </div>

        {/* Inflows / outflows */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-[var(--color-success)]" />
            <div>
              <p className="text-xs text-white/45">Entradas</p>
              <p className="mono text-[15px] text-white font-medium">
                {formatMoney(data.inflows)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className="size-4 text-[var(--color-danger)]" />
            <div>
              <p className="text-xs text-white/45">Salidas</p>
              <p className="mono text-[15px] text-white font-medium">
                {formatMoney(data.outflows)}
              </p>
            </div>
          </div>
        </div>

        {/* Burn + runway */}
        {(data.burn_daily || data.runway_days) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-white/55 pt-2 border-t border-white/[0.04]">
            {data.burn_daily && (
              <span>
                Burn <span className="mono text-white/75">{formatMoney(data.burn_daily)}</span>/día
              </span>
            )}
            {data.runway_days && (
              <span>
                Runway <span className="mono text-white/75">{data.runway_days}d</span>
              </span>
            )}
            {data.forecast_30d !== undefined && (
              <span>
                Forecast 30d{" "}
                <span
                  className={cn(
                    "mono",
                    data.forecast_30d >= 0 ? "text-[var(--color-noa)]" : "text-[var(--color-danger)]",
                  )}
                >
                  {formatMoney(data.forecast_30d, { sign: true })}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="px-5 pb-4 pt-1 flex gap-2 -mx-5">
        <Button variant="secondary" size="sm" className="ml-5">
          Forecast 30d →
        </Button>
        <Button variant="ghost" size="sm">
          Ver desglose
        </Button>
      </div>
    </Card>
  );
}
