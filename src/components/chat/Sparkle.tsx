/**
 * Sparkle — anchor visual KOAI (no copy de Google rainbow).
 *
 * Diamond ◆ 4-pointed con gradient lime → purple (KOAI brand).
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
      <defs>
        <linearGradient id="koaiSparkleGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#C8DD4A" />
          <stop offset="50%" stopColor="#7B6CB5" />
          <stop offset="100%" stopColor="#6B3F8E" />
        </linearGradient>
      </defs>
      {/* Diamond ◆ con curvas concavas (4-pointed star Gemini-style) */}
      <path
        d="M16 1 C 17 9, 23 15, 31 16 C 23 17, 17 23, 16 31 C 15 23, 9 17, 1 16 C 9 15, 15 9, 16 1 Z"
        fill="url(#koaiSparkleGrad)"
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
