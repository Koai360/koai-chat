import { Wand2, Sparkles, Brain, ChevronDown, Check } from "lucide-react";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/Dropdown";
import { cn } from "@/lib/cn";
import type { ModelMode } from "@/lib/autoThinking";

/**
 * ModelPicker — selector visible arriba del chat.
 *
 * 3 modos (todos sobre Gemini 3.5 Flash, cambia el thinking_level):
 *   - Auto (default)  → Noa elige nivel según la pregunta (autoThinkingLevel)
 *   - Estándar        → siempre medium thinking
 *   - Pro             → siempre high thinking (análisis profundos)
 *
 * Visual TopBar:
 *   - Auto activo:    "Noa ⌄"
 *   - Estándar:       "Noa · Estándar ⌄"
 *   - Pro:            "Noa · Pro ⌄"
 */

interface ModeOption {
  mode: ModelMode;
  label: string;
  shortLabel: string | null; // null = no se muestra en el pill (caso Auto)
  description: string;
  icon: React.ReactNode;
}

const OPTIONS: ModeOption[] = [
  {
    mode: "auto",
    label: "Auto",
    shortLabel: null,
    description: "Noa decide según tu pregunta",
    icon: <Wand2 className="size-4 text-[var(--color-noa)]" />,
  },
  {
    mode: "standard",
    label: "Estándar",
    shortLabel: "Estándar",
    description: "Pensamiento equilibrado",
    icon: <Sparkles className="size-4 text-white/80" />,
  },
  {
    mode: "pro",
    label: "Pro",
    shortLabel: "Pro",
    description: "Análisis profundos",
    icon: <Brain className="size-4 text-[var(--color-purple)]" />,
  },
];

interface ModelPickerProps {
  mode: ModelMode;
  onChange: (mode: ModelMode) => void;
  className?: string;
}

export function ModelPicker({ mode, onChange, className }: ModelPickerProps) {
  const current = OPTIONS.find((o) => o.mode === mode) ?? OPTIONS[0];

  return (
    <Dropdown
      align="center"
      side="bottom"
      trigger={
        <button
          aria-label={`Modo: ${current.label}. Cambiar.`}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full",
            "text-white hover:bg-white/[0.06] active:bg-white/[0.10]",
            "transition-colors duration-150",
            "min-h-[36px]",
            "focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-[var(--color-noa)]/40",
            className,
          )}
        >
          <span className="display text-[16px] font-semibold leading-none">Noa</span>
          {current.shortLabel && (
            <>
              <span className="text-white/30 leading-none">·</span>
              <span className="mono text-[11px] text-white/55 tracking-tight uppercase leading-none">
                {current.shortLabel}
              </span>
            </>
          )}
          <ChevronDown className="size-3.5 text-white/40" />
        </button>
      }
    >
      <div className="px-3 py-2 mb-1">
        <p className="mono text-[10px] uppercase tracking-[0.12em] text-white/45 font-medium">
          Modo
        </p>
      </div>
      <DropdownSeparator />
      {OPTIONS.map((opt) => {
        const active = opt.mode === mode;
        return (
          <DropdownItem key={opt.mode} icon={opt.icon} onClick={() => onChange(opt.mode)}>
            <div className="flex-1 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-white/95 font-medium leading-tight">{opt.label}</p>
                <p className="text-[12px] text-white/50 leading-tight mt-0.5">{opt.description}</p>
              </div>
              {active && <Check className="size-4 text-[var(--color-noa)] shrink-0 mt-0.5" />}
            </div>
          </DropdownItem>
        );
      })}
    </Dropdown>
  );
}
