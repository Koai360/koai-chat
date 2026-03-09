import { cn } from "@/lib/utils";

interface Props {
  agent: "kira" | "kronos";
  size?: "sm" | "md" | "lg";
  glow?: boolean;
  className?: string;
}

const sizes = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-12 h-12",
};

export function AgentAvatar({ agent, size = "md", glow = false, className }: Props) {
  const src = agent === "kronos" ? "/icons/kronos-logo.svg" : "/icons/kira-logo.svg";
  const glowColor = agent === "kronos" ? "var(--color-kronos-glow)" : "var(--color-kira-glow)";

  return (
    <img
      src={src}
      alt={agent}
      className={cn(
        "rounded-full flex-shrink-0",
        sizes[size],
        glow && "animate-glow-pulse",
        className,
      )}
      style={glow ? { "--glow-color": glowColor } as React.CSSProperties : undefined}
    />
  );
}
