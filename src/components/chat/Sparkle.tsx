import { cn } from "@/lib/cn";

/**
 * Sparkle — anchor visual de Noa.
 *
 * S232: era un diamante ◆ de 4 puntas dibujado a mano en SVG. Pasó a ser la
 * marca real (cerebro hexagonal): primero como PNG, y ahora como el vector que
 * mandó Jesús, que es lo que permite animarla de verdad.
 *
 * Referencia el sprite (<NoaMarkSprite>, montado una vez en el root) vía <use>,
 * así 40 avatares en un chat no cargan 40 copias de los paths.
 *
 * El nombre del componente y su API (`size`, `className`, `animate`, `mode`) se
 * mantienen para no tocar los 9 lugares que lo usan.
 *
 * Estados (globals.css §marca de Noa):
 *   sin modo         → estático (avatar de cada burbuja, sidebar): NO anima
 *   mode="idle"      → pulso lento recorriendo los circuitos
 *   mode="thinking"  → pulso más rápido + respira
 *   mode="streaming" → corriente: varios destellos recorriendo el trazo
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
  idle: "nm-idle",
  thinking: "nm-think",
  streaming: "nm-stream",
};

export function Sparkle({ size = 32, className, animate = false, mode }: SparkleProps) {
  const resolved: SparkleMode | null = mode ?? (animate ? "idle" : null);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1322.81 1384.88"
      className={cn("noa-mark block", resolved && MODE_CLASS[resolved], className)}
      aria-hidden
    >
      <use href="#noa-mark" />
    </svg>
  );
}
