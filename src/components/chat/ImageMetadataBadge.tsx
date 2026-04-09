import { motion } from "framer-motion";

/**
 * ImageMetadataBadge — minimal mono-style badge shown above generated images.
 *
 * Displays the engine, generation time, and estimated cost — all in JetBrains Mono
 * micro-text. No icon clichés, no colored pills, just structured metadata in the
 * style of Linear / Vercel deploy logs.
 *
 * Engine name gets a single-letter "mark" prefix matching EngineSelector colors,
 * for visual continuity. Time and cost are dim gray.
 */

interface Props {
  engine: string;
  generationTimeMs?: number;
  costEstimateUsd?: number;
}

const ENGINE_DISPLAY: Record<string, { mark: string; label: string; color: string }> = {
  // Generación
  "studioflux-zimage":     { mark: "Z", label: "Z-Image",        color: "#D4E94B" },
  "studioflux-flux2":      { mark: "F", label: "Flux.2 Pro",     color: "#7B2D8E" },
  "studioflux":            { mark: "Z", label: "Z-Image",        color: "#D4E94B" }, // legacy
  "studioflux-raw":        { mark: "R", label: "Studio RAW",     color: "#E8704A" },
  "flux-2-max":            { mark: "B", label: "Flux Hosted",    color: "#00E5FF" },
  "flux-2-pro":            { mark: "B", label: "Flux Pro",       color: "#00E5FF" },
  "gemini":                { mark: "G", label: "Gemini",         color: "rgba(255,255,255,0.85)" },
  "gemini-3.1-flash-image-preview": { mark: "G", label: "Gemini", color: "rgba(255,255,255,0.85)" },
  "ideogram":              { mark: "I", label: "Ideogram",       color: "rgba(255,255,255,0.85)" },
  "recraft":               { mark: "C", label: "Recraft",        color: "rgba(255,255,255,0.85)" },
  // Edición (edit_image_smart + sus backends)
  "gemini-edit":           { mark: "G", label: "Gemini Edit",    color: "rgba(255,255,255,0.85)" },
  "flux-kontext-pro":      { mark: "K", label: "Kontext Pro",    color: "#7B2D8E" },
  "flux-kontext-dev-modal":{ mark: "K", label: "Kontext Dev",    color: "#D4E94B" },
  "studioflux-kontext":    { mark: "K", label: "Kontext Dev",    color: "#D4E94B" },
};

function formatTime(ms: number | undefined): string {
  if (!ms || ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatCost(usd: number | undefined): string {
  if (usd === undefined || usd === null) return "—";
  if (usd === 0) return "free";
  if (usd < 0.01) return `$${(usd * 1000).toFixed(1)}m`; // 0.001 → "$1.0m" (millicents)
  return `$${usd.toFixed(3)}`;
}

export function ImageMetadataBadge({ engine, generationTimeMs, costEstimateUsd }: Props) {
  const display = ENGINE_DISPLAY[engine] || {
    mark: "?",
    label: engine,
    color: "rgba(255,255,255,0.55)",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="
        inline-flex items-center gap-2
        px-2 py-1
        rounded-md
        font-mono text-[10px]
        select-none
      "
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Engine mark + label */}
      <span className="flex items-center gap-1">
        <span
          className="font-display font-bold leading-none"
          style={{
            fontSize: "11px",
            color: display.color,
            letterSpacing: "-0.04em",
          }}
        >
          {display.mark}
        </span>
        <span style={{ color: display.color, opacity: 0.95 }}>{display.label}</span>
      </span>

      {/* Separator dot */}
      {(generationTimeMs !== undefined || costEstimateUsd !== undefined) && (
        <span className="text-text-subtle opacity-40">·</span>
      )}

      {/* Time */}
      {generationTimeMs !== undefined && (
        <span className="text-text-subtle">{formatTime(generationTimeMs)}</span>
      )}

      {/* Separator dot */}
      {generationTimeMs !== undefined && costEstimateUsd !== undefined && (
        <span className="text-text-subtle opacity-40">·</span>
      )}

      {/* Cost */}
      {costEstimateUsd !== undefined && (
        <span className="text-text-subtle">{formatCost(costEstimateUsd)}</span>
      )}
    </motion.div>
  );
}
