/**
 * Sparkle — anchor visual KOAI (no copy de Google rainbow).
 *
 * Diamond ◆ 4-pointed en lime neón sólido KOAI (#C8DD4A).
 * Tamaño base 32px, escalable via prop `size`.
 * Animación pulse opcional (loop 2.4s, muy sutil).
 */

interface SparkleProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

export function Sparkle({ size = 32, className, animate = false }: SparkleProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      style={animate ? { animation: "sparklePulse 2.4s ease-in-out infinite" } : undefined}
    >
      {/* Diamond ◆ con curvas concavas (4-pointed star Gemini-style) */}
      <path
        d="M16 1 C 17 9, 23 15, 31 16 C 23 17, 17 23, 16 31 C 15 23, 9 17, 1 16 C 9 15, 15 9, 16 1 Z"
        fill="#C8DD4A"
      />
      <style>{`
        @keyframes sparklePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(0.96); }
        }
        @media (prefers-reduced-motion: reduce) {
          svg { animation: none !important; }
        }
      `}</style>
    </svg>
  );
}
