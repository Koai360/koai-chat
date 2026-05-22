import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "rect" | "circle";
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  variant = "rect",
  width,
  height,
  className,
  style,
  ...rest
}: SkeletonProps) {
  const shape =
    variant === "circle" ? "rounded-full" : variant === "text" ? "rounded-md h-4" : "rounded-lg";

  return (
    <div
      className={cn(
        "skeleton-shimmer bg-white/[0.04]",
        shape,
        className,
      )}
      style={{
        width,
        height: height ?? (variant === "text" ? "1rem" : undefined),
        ...style,
      }}
      {...rest}
    />
  );
}

// Inyectamos keyframes shimmer en globals (mejor) o aquí inline
// Versión inline backup:
const _shimmerCSS = `
@keyframes skeletonShimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton-shimmer {
  background-image: linear-gradient(
    90deg,
    rgba(255,255,255,0.04) 0%,
    rgba(255,255,255,0.08) 50%,
    rgba(255,255,255,0.04) 100%
  );
  background-size: 200% 100%;
  animation: skeletonShimmer 2s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .skeleton-shimmer { animation: none; }
}
`;

if (typeof document !== "undefined" && !document.getElementById("skeleton-shimmer-css")) {
  const styleEl = document.createElement("style");
  styleEl.id = "skeleton-shimmer-css";
  styleEl.textContent = _shimmerCSS;
  document.head.appendChild(styleEl);
}
