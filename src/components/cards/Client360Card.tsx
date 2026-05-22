import { User, Mail } from "lucide-react";
import { Card } from "./Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { formatMoney, relativeTime } from "@/lib/format";

export interface Client360CardData {
  client?: string;
  business?: string;
  status?: string;
  mrr?: number;
  ltv?: number;
  invoices_count?: number;
  open_orders?: number;
  plaid_payments?: number;
  last_interaction?: string;
}

interface Client360CardProps {
  data: Client360CardData;
  pending?: boolean;
}

export function Client360Card({ data, pending }: Client360CardProps) {
  return (
    <Card
      title={data.client || "Cliente"}
      subtitle={data.business}
      icon={<User className="size-[18px] text-[var(--color-noa)]" />}
      pending={pending}
    >
      <div className="space-y-3">
        {data.status && (
          <Pill tone="noa">{data.status}</Pill>
        )}

        <div className="grid grid-cols-2 gap-2">
          {data.mrr !== undefined && (
            <StatCell label="MRR" value={formatMoney(data.mrr)} />
          )}
          {data.ltv !== undefined && (
            <StatCell label="LTV" value={formatMoney(data.ltv)} />
          )}
          {data.invoices_count !== undefined && (
            <StatCell label="Facturas" value={String(data.invoices_count)} />
          )}
          {data.open_orders !== undefined && (
            <StatCell label="Pedidos abiertos" value={String(data.open_orders)} />
          )}
          {data.plaid_payments !== undefined && (
            <StatCell label="Pagos Plaid" value={String(data.plaid_payments)} />
          )}
          {data.last_interaction && (
            <StatCell label="Última interacción" value={relativeTime(data.last_interaction)} />
          )}
        </div>
      </div>

      <div className="px-5 pb-4 pt-1 flex flex-wrap gap-2 -mx-5">
        <Button variant="secondary" size="sm" className="ml-5">
          Abrir 360 →
        </Button>
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<Mail className="size-4" />}
        >
          Redactar email
        </Button>
      </div>
    </Card>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.03] rounded-lg p-2.5 border border-white/[0.04]">
      <p className="text-[11px] text-white/45 uppercase tracking-wide">{label}</p>
      <p className="mono text-[14px] text-white font-medium mt-0.5">{value}</p>
    </div>
  );
}
