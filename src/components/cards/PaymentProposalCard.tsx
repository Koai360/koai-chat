import { CreditCard, ShieldCheck, X } from "lucide-react";
import { Card } from "./Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { formatMoney, relativeTime } from "@/lib/format";

export interface PaymentProposalCardData {
  proposal_id?: string;
  client?: string;
  amount?: number;
  factura?: string;
  evidence?: string;
  evidence_source?: string;
  detected_at?: string;
}

interface PaymentProposalCardProps {
  data: PaymentProposalCardData;
  pending?: boolean;
  onConfirm?: (proposalId: string) => void;
  onCancel?: (proposalId: string) => void;
}

export function PaymentProposalCard({
  data,
  pending = true,
  onConfirm,
  onCancel,
}: PaymentProposalCardProps) {
  const proposalId = data.proposal_id || "";

  return (
    <Card
      title="Pago propuesto"
      subtitle={data.client}
      icon={<CreditCard className="size-[18px] text-[var(--color-warning)]" />}
      pending={pending}
    >
      <div className="space-y-3">
        {pending && (
          <Pill tone="warning" leadingIcon={<ShieldCheck className="size-3" />}>
            Requiere tu confirmación
          </Pill>
        )}

        {data.amount !== undefined && (
          <div className="flex items-end gap-2">
            <p className="mono text-[24px] font-medium text-white leading-none">
              {formatMoney(data.amount)}
            </p>
          </div>
        )}

        <div className="space-y-2 text-[14px]">
          {data.factura && (
            <Row label="Factura" value={data.factura} mono />
          )}
          {data.evidence && (
            <Row
              label="Evidencia"
              value={
                <>
                  <span className="mono text-[13px]">{data.evidence}</span>
                  {data.evidence_source && (
                    <span className="text-white/55 ml-2">({data.evidence_source})</span>
                  )}
                </>
              }
            />
          )}
          {data.detected_at && (
            <Row label="Detectado" value={relativeTime(data.detected_at)} />
          )}
        </div>
      </div>

      <div className="pt-3 flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"

          leadingIcon={<ShieldCheck className="size-4" />}
          onClick={() => onConfirm?.(proposalId)}
        >
          Confirmar pago
        </Button>
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<X className="size-4" />}
          onClick={() => onCancel?.(proposalId)}
        >
          Cancelar
        </Button>
      </div>
    </Card>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-white/55 shrink-0 w-20 text-[13px]">{label}:</span>
      <span className={mono ? "mono text-white/90 text-[13px]" : "text-white/90 text-[14px]"}>
        {value}
      </span>
    </div>
  );
}
