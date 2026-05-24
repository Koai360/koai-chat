import { useId } from "react";

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

/**
 * Sparkline — mini line chart inline, SVG puro (cero deps).
 *
 * Auto-scales al rango min-max de los values. Si todos iguales, línea horizontal.
 * Color default: lime KOAI con sutil gradient fade bottom.
 */
export function Sparkline({
  values,
  width = 200,
  height = 40,
  color = "var(--color-noa)",
  className,
}: SparklineProps) {
  // P2-4 audit: useId genera un id estable (no impure como Math.random)
  // que React garantiza único por instancia. SVG <defs> necesita id único
  // para que cada sparkline en la página tenga su propio gradient.
  const gradId = `sparkline-grad-${useId().replace(/:/g, "")}`;
  if (!values || values.length < 2) {
    return (
      <div
        className={className}
        style={{
          width,
          height,
          background: "var(--color-bg-overlay)",
          borderRadius: 6,
        }}
      />
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPoints = `${points} ${width},${height} 0,${height}`;
  // P2-4 audit: useId() en vez de Math.random() — id estable + pure render.
  const gradientId = gradId;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradientId})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
