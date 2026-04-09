import { motion } from "framer-motion";

/**
 * EngineSelector — visual model picker compacto.
 *
 * 4 cards en grid de 4 columnas. Stack unificado post-S106:
 *   - gemini: rápido gratis, filtra NSFW
 *   - zimage: default barato sin filtro (Modal)
 *   - flux2:  premium sin filtro (Modal)
 *   - raw:    Z-Image sin enhancer, prompt directo (modo avanzado / NSFW explícito)
 *
 * Cada card tiene:
 *   - mark grande (letra inicial color-coded por tier)
 *   - label corto debajo
 *
 * La descripción detallada (precio, velocidad) se muestra en una FILA debajo
 * solo del engine activo, en estilo mono micro-label tipo Linear/Vercel logs.
 */

export type EngineValue =
  | "gemini"
  | "zimage"
  | "flux2"
  | "studioflux-raw";

export interface EngineOption {
  value: EngineValue;
  label: string;
  desc: string;
  tier: "free" | "value" | "premium" | "raw";
  mark: string;
}

export const ENGINE_OPTIONS: readonly EngineOption[] = [
  { value: "gemini",          label: "Rápida",  desc: "Gemini · gratis · ~3s",                 tier: "free",    mark: "G" },
  { value: "zimage",          label: "Z-Image", desc: "Modal · sin filtro · $0.016 · ~5s",     tier: "value",   mark: "Z" },
  { value: "flux2",           label: "Flux.2",  desc: "Modal · 32B premium · $0.035 · ~30s",   tier: "premium", mark: "F" },
  { value: "studioflux-raw",  label: "Raw",     desc: "Z-Image · sin enhancer · prompt directo", tier: "raw",    mark: "R" },
] as const;

interface Props {
  value: EngineValue;
  onChange: (value: EngineValue) => void;
}

const TIER_COLOR: Record<EngineOption["tier"], { mark: string; glow: string; bg: string }> = {
  free:    { mark: "rgba(255,255,255,0.85)", glow: "rgba(255,255,255,0.18)", bg: "rgba(255,255,255,0.04)" },
  value:   { mark: "#D4E94B",                glow: "rgba(212,233,75,0.35)",  bg: "rgba(212,233,75,0.06)"  },
  premium: { mark: "#7B2D8E",                glow: "rgba(123,45,142,0.40)",  bg: "rgba(123,45,142,0.08)"  },
  raw:     { mark: "#E8704A",                glow: "rgba(232,112,74,0.35)",  bg: "rgba(232,112,74,0.06)"  },
};

export function EngineSelector({ value, onChange }: Props) {
  const active = ENGINE_OPTIONS.find((o) => o.value === value);
  const activeColors = active ? TIER_COLOR[active.tier] : null;

  return (
    <div className="w-full">
      {/* Header — minimalista, mono */}
      <div className="px-1 mb-1.5 flex items-baseline justify-between">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-subtle">
          Motor
        </span>
        <span className="font-mono text-[9px] tracking-tight text-text-subtle">
          {ENGINE_OPTIONS.length} disponibles
        </span>
      </div>

      {/* Grid 3 cols en mobile, 4 cols en desktop. El engine "raw" solo se muestra en md+ */}
      <div
        role="radiogroup"
        aria-label="Motor de generación de imagen"
        className="grid grid-cols-3 md:grid-cols-4 gap-1.5"
      >
        {ENGINE_OPTIONS.map((opt, i) => {
          const isActive = value === opt.value;
          const colors = TIER_COLOR[opt.tier];
          // "raw" solo visible en desktop (≥ md: 768px)
          const desktopOnly = opt.tier === "raw";
          return (
            <motion.button
              key={opt.value}
              role="radio"
              aria-checked={isActive}
              aria-label={`${opt.label} — ${opt.desc}`}
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(8);
                onChange(opt.value);
              }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.3,
                delay: 0.03 * i,
                ease: [0.16, 1, 0.3, 1],
              }}
              whileTap={{ scale: 0.94 }}
              className={`
                relative
                rounded-xl
                py-2 px-1
                flex-col items-center justify-center gap-0.5
                min-h-[58px]
                transition-[border-color,box-shadow,background] duration-300
                ${desktopOnly ? "hidden md:flex" : "flex"}
                ${isActive ? "" : "hover:bg-bg-surface"}
              `}
              style={{
                background: isActive ? colors.bg : "transparent",
                boxShadow: isActive
                  ? `inset 0 0 0 1.5px ${colors.glow}, 0 4px 12px -4px ${colors.glow}`
                  : "inset 0 0 0 1px rgba(255,255,255,0.06)",
              }}
            >
              {/* Mark — letter, color-coded */}
              <span
                className="font-display font-bold leading-none select-none"
                style={{
                  fontSize: "20px",
                  color: colors.mark,
                  letterSpacing: "-0.04em",
                  textShadow: isActive ? `0 0 14px ${colors.glow}` : "none",
                  transition: "text-shadow 0.3s ease",
                }}
              >
                {opt.mark}
              </span>

              {/* Label — small, truncated */}
              <span
                className="font-display text-[10px] font-medium leading-tight truncate w-full text-center px-0.5"
                style={{
                  letterSpacing: "-0.01em",
                  color: isActive ? colors.mark : "rgba(255,255,255,0.7)",
                  transition: "color 0.3s ease",
                }}
              >
                {opt.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Description row — only of active engine, mono micro-label */}
      {active && activeColors && (
        <motion.div
          key={value}
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mt-2 px-1 font-mono text-[10px] truncate text-center"
          style={{ color: activeColors.mark, opacity: 0.85 }}
        >
          {active.desc}
        </motion.div>
      )}
    </div>
  );
}
