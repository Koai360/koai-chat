/**
 * SendCards — tarjetas de "envío en espera" y su resultado (S347, ADR 0077).
 *
 * Vienen del SERVIDOR como evento SSE `send_card`, nunca como texto del modelo: si la tarjeta
 * viajara dentro del Markdown de Noa, el modelo controlaría el contexto de parseo (un comentario
 * HTML o un fence abierto antes) y podría esconder el destinatario o parte del texto dejando el
 * código visible (lo reprodujo Codex). Acá TODO se renderiza como texto literal (React escapa),
 * sin Markdown ni preprocesado: lo que Jesús ve es exactamente lo que el servidor enviará.
 */
import { memo, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Send, XCircle } from "lucide-react";
import type { SendCard } from "@/types/api";

function ResultIcon({ estado }: { estado: string }) {
  if (estado === "enviado" || estado === "ya enviado") return <CheckCircle2 size={16} className="shrink-0 text-emerald-300" />;
  if (estado.startsWith("incierto") || estado.startsWith("en curso")) return <AlertTriangle size={16} className="shrink-0 text-amber-300" />;
  return <XCircle size={16} className="shrink-0 text-red-300" />;
}

function ProposalCard({ card }: { card: SendCard }) {
  const [copied, setCopied] = useState(false);
  const phrase = card.confirm_phrase ?? (card.code ? `confirmo envío ${card.code}` : "");
  const c = card.contact;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(phrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* sin clipboard: la frase queda visible para tipearla */
    }
  };
  return (
    <div className="mt-2 rounded-xl border border-lime-300/30 bg-white/[0.03] p-3 text-[14px] leading-[1.45]">
      <div className="flex items-center gap-1.5 font-semibold text-lime-200">
        <Send size={15} className="shrink-0" />
        <span>Envío en espera de tu confirmación</span>
      </div>
      <div className="mt-0.5 text-[12.5px] text-white/60">Todavía NO salió nada.</div>
      {c && (
        <div className="mt-2 text-[13px] text-white/85">
          <span className="text-white/55">Para: </span>
          <span className="font-medium">{c.name}</span>
          {c.phone ? <span> · {c.phone}</span> : null}
          <span className="text-white/55"> · respond.io id {String(c.contact_id)}</span>
          <span className="text-white/55"> · canal {c.channel_label} ({String(c.channel_id)})</span>
        </div>
      )}
      <div className="mt-2 text-[12.5px] text-white/55">Texto exacto que saldría:</div>
      <pre className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-black/40 p-2.5 font-sans text-[14px] text-white/90">
        {card.text ?? ""}
      </pre>
      <div className="mt-2.5 text-[13px] text-white/85">
        Para enviarlo tal cual, respondé sólo:
      </div>
      <div className="mt-1 flex items-center gap-2">
        <code className="rounded-md bg-lime-300/15 px-2 py-1 font-mono text-[14px] text-lime-100">{phrase}</code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-[12px] text-white/75 hover:bg-white/[0.06]"
        >
          <Copy size={12} />
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <div className="mt-2 text-[12px] text-white/50">
        Vale sólo como tu próximo mensaje en este chat y durante {Math.round((card.ttl_s ?? 900) / 60)} minutos; cualquier otro mensaje lo cancela.
      </div>
    </div>
  );
}

function ResultCard({ card }: { card: SendCard }) {
  const estado = card.estado ?? "";
  return (
    <div className="mt-2 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[14px] leading-[1.45] text-white/90">
      <ResultIcon estado={estado} />
      <span className="whitespace-pre-wrap break-words">{card.mensaje ?? ""}</span>
    </div>
  );
}

export const SendCards = memo(function SendCards({ cards }: { cards: SendCard[] }) {
  return (
    <div className="flex flex-col">
      {cards.map((card, i) =>
        card.kind === "proposal" ? (
          <ProposalCard key={card.propuesta_id ?? i} card={card} />
        ) : (
          <ResultCard key={`r-${i}`} card={card} />
        ),
      )}
    </div>
  );
});
