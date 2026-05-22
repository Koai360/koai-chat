import { useState } from "react";
import { Mail, Check, Pencil, X, ChevronDown } from "lucide-react";
import { Card } from "./Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

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
  onSend?: (draftId: string) => void;
  onEdit?: (draftId: string) => void;
  onDiscard?: (draftId: string) => void;
}

export function DraftEmailCard({ data, pending, onSend, onEdit, onDiscard }: DraftEmailCardProps) {
  const [expanded, setExpanded] = useState(false);
  const preview = data.preview || (data.body ? data.body.slice(0, 200) : "");
  const fullBody = data.body || preview;
  const draftId = data.draft_id || "";

  return (
    <Card
      title="Draft preparado"
      subtitle={data.to ? `Para ${data.to}` : undefined}
      icon={<Mail className="size-[18px] text-[var(--color-noa)]" />}
      pending={pending}
    >
      <div className="space-y-3">
        {data.subject && (
          <div className="flex gap-2 text-[14px]">
            <span className="text-white/45 shrink-0 w-16">Asunto:</span>
            <span className="text-white/95 truncate">{data.subject}</span>
          </div>
        )}

        <div className="bg-[var(--color-bg-overlay)] rounded-lg p-3 border border-white/[0.04]">
          <p
            className={cn(
              "text-[14px] text-white/85 leading-relaxed whitespace-pre-wrap",
              !expanded && "line-clamp-4",
            )}
          >
            {expanded ? fullBody : preview}
          </p>
          {fullBody.length > preview.length && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 text-xs text-white/55 hover:text-white"
            >
              {expanded ? "Ver menos" : "Ver completo"}
              <ChevronDown className={cn("size-3 transition-transform", expanded && "rotate-180")} />
            </button>
          )}
        </div>
      </div>

      <div className="px-5 pb-4 pt-1 flex flex-wrap gap-2 -mx-5">
        <Button
          variant="primary"
          size="sm"
          className="ml-5"
          leadingIcon={<Check className="size-4" />}
          onClick={() => onSend?.(draftId)}
        >
          Enviar
        </Button>
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Pencil className="size-4" />}
          onClick={() => onEdit?.(draftId)}
        >
          Editar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<X className="size-4" />}
          onClick={() => onDiscard?.(draftId)}
        >
          Descartar
        </Button>
      </div>
    </Card>
  );
}
