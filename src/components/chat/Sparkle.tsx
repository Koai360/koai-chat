import { cn } from "@/lib/cn";

/**
 * Sparkle — anchor visual KOAI (no copy de Google rainbow).
 *
 * Diamond ◆ 4-pointed en lime neón sólido KOAI (#C8DD4A).
 * Tamaño base 32px, escalable via prop `size`.
 *
 * S161 "Noa Alive" — estados vivos (keyframes en globals.css §motion pack):
 *   mode="idle"      → pulse sutil 2.4s (equivale al viejo `animate`)
 *   mode="thinking"  → respira + bascula + glow lime (Noa procesando)
 *   mode="streaming" → giro continuo + glow (Noa escribiendo)
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
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(resolved && MODE_CLASS[resolved], className)}
      aria-hidden
    >
      {/* Diamond ◆ con curvas concavas (4-pointed star Gemini-style) */}
      <path
        d="M16 1 C 17 9, 23 15, 31 16 C 23 17, 17 23, 16 31 C 15 23, 9 17, 1 16 C 9 15, 15 9, 16 1 Z"
        fill="#C8DD4A"
      />
    </svg>
  );
}
