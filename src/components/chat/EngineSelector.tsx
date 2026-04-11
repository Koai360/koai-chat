import { motion } from "framer-motion";

/**
 * EngineSelector — visual model picker.
 *
 * Mobile: 3 engines primarios (gemini/zimage/flux2) en grid 3 cols.
 * Desktop (md+): 9 engines totales organizados en 2 filas de 5 columnas:
 *   Fila 1 — Flux family: gemini, zimage, flux1, flux2, raw
 *   Fila 2 — SDXL stack:  sdxl-dreamshaper, sdxl-realistic, sdxl-cyber, sdxl-pony, sdxl-illustrious
 *
 * Cada card tiene mark grande (letra color-coded por tier) + label corto.
 * Descripción detallada del engine activo aparece debajo en mono micro-label.
 */

export type EngineValue =
  | "gemini"
  | "zimage"
  | "flux1"
  | "flux2"
  | "studioflux-raw"
  | "sdxl"
  | "sdxl-dreamshaper"
  | "sdxl-realistic"
  | "sdxl-cyber"
  | "sdxl-pony"
  | "sdxl-illustrious";

export interface EngineOption {
  value: EngineValue;
  label: string;
  desc: string;
  tier: "free" | "value" | "premium" | "raw" | "sdxl" | "anime";
  mark: string;
  desktopOnly?: boolean;
}

export const ENGINE_OPTIONS: readonly EngineOption[] = [
  // Primary — mobile + desktop
  { value: "gemini",          label: "Rápida",    desc: "Gemini · gratis · ~3s",                     tier: "free",    mark: "G" },
  { value: "zimage",          label: "Z-Image",   desc: "Modal · sin filtro · $0.016 · ~5s",         tier: "value",   mark: "Z" },
  { value: "flux2",           label: "Flux.2",    desc: "Modal · 32B frontier · $0.035 · ~30s",      tier: "premium", mark: "F" },
  { value: "sdxl",            label: "SDXL",      desc: "Noa elige el mejor SDXL · $0.006 · ~10s",  tier: "sdxl",    mark: "S" },
  // Desktop-only — advanced Flux family
  { value: "flux1",           label: "Flux.1",    desc: "Modal · 12B permisivo · $0.018 · ~25s",     tier: "value",   mark: "1", desktopOnly: true },
  { value: "studioflux-raw",  label: "Raw",       desc: "Z-Image · sin enhancer · prompt directo",   tier: "raw",     mark: "R", desktopOnly: true },
  // Desktop-only — SDXL stack
  { value: "sdxl-dreamshaper",label: "Dream",     desc: "DreamShaper XL · versátil · $0.006 · ~10s", tier: "sdxl",    mark: "D", desktopOnly: true },
  { value: "sdxl-realistic",  label: "RealVis",   desc: "RealVisXL V5 · fotorrealismo · $0.006",     tier: "sdxl",    mark: "V", desktopOnly: true },
  { value: "sdxl-cyber",      label: "Cyber",     desc: "CyberRealistic XL · portraits NSFW",        tier: "sdxl",    mark: "C", desktopOnly: true },
  { value: "sdxl-pony",       label: "Pony",      desc: "Pony V6 XL · anime/cartoon NSFW · $0.005",  tier: "anime",   mark: "P", desktopOnly: true },
  { value: "sdxl-illustrious",label: "Illus",     desc: "Illustrious XL · anime alta fidelidad",     tier: "anime",   mark: "I", desktopOnly: true },
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
  sdxl:    { mark: "#4A9EFF",                glow: "rgba(74,158,255,0.35)",  bg: "rgba(74,158,255,0.06)"  },
  anime:   { mark: "#F06BA8",                glow: "rgba(240,107,168,0.35)", bg: "rgba(240,107,168,0.06)" },
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

      {/* Grid 3 cols en mobile, 5 cols en desktop (2 filas de 5 = 10 engines).
          Los engines con desktopOnly=true solo se muestran en md+ */}
      <div
        role="radiogroup"
        aria-label="Motor de generación de imagen"
        className="grid grid-cols-4 md:grid-cols-5 gap-1.5"
      >
        {ENGINE_OPTIONS.map((opt, i) => {
          const isActive = value === opt.value;
          const colors = TIER_COLOR[opt.tier];
          const desktopOnly = !!opt.desktopOnly;
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
