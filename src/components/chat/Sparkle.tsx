import { cn } from "@/lib/cn";

/**
 * Sparkle — anchor visual de Noa.
 *
 * S232: era un diamante ◆ de 4 puntas dibujado en SVG (lime #C8DD4A). Ahora es
 * la marca real de Noa (cerebro hexagonal), servida como PNG con transparencia
 * desde /icons/noa-mark.png — el original trae degradado y brillo 3D, así que
 * vectorizarlo habría perdido justo lo que lo hace verse bien.
 *
 * El nombre del componente y su API (`size`, `className`, `animate`, `mode`) se
 * mantienen para no tocar los 6 lugares que lo usan.
 *
 * Estados vivos (keyframes en globals.css §motion pack):
 *   mode="idle"      → pulse sutil 2.4s (equivale al viejo `animate`)
 *   mode="thinking"  → respira + bascula + glow lime (Noa procesando)
 *   mode="streaming" → latido con glow (Noa escribiendo)
 */

type SparkleMode = "idle" | "thinking" | "streaming";

interface SparkleProps {
  size?: number;
  className?: string;
  /** Legacy: animate=true equivale a mode="idle" */
  animate?: boolean;
  mode?: SparkleMode;
}

const MODE_CLASS: Record<SparkleMode, string> = {
  idle: "sparkle-idle",
  thinking: "sparkle-think",
  streaming: "sparkle-stream",
};

export function Sparkle({ size = 32, className, animate = false, mode }: SparkleProps) {
  const resolved: SparkleMode | null = mode ?? (animate ? "idle" : null);
  return (
    <img
      src="/icons/noa-mark.png"
      width={size}
      height={size}
      alt=""
      aria-hidden
      // El PNG es 192px: a los tamaños de uso (20-40px) queda nítido incluso en
      // pantallas 3x. `block` evita el hueco de línea base que mete <img> inline.
      className={cn("block select-none", resolved && MODE_CLASS[resolved], className)}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}
