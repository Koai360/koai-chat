interface Props {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = { sm: 24, md: 40, lg: 56 } as const;

export function AIStarIcon({ size = "md", className = "" }: Props) {
  const px = SIZES[size];
  const isLg = size === "lg";

  const star = (
    <svg
      width={px}
      height={px}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="ai-star-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff6b35" />
          <stop offset="50%" stopColor="#9b59b6" />
          <stop offset="100%" stopColor="#e91e8a" />
        </linearGradient>
      </defs>
      {/* 4-pointed star / sparkle shape */}
      <path
        d="M28 4 C30 20, 36 26, 52 28 C36 30, 30 36, 28 52 C26 36, 20 30, 4 28 C20 26, 26 20, 28 4Z"
        fill="url(#ai-star-grad)"
      />
      {/* Decorative sparkle dots */}
      <circle cx="16" cy="14" r="1.5" fill="white" opacity="0.7" />
      <circle cx="42" cy="16" r="1" fill="white" opacity="0.5" />
      <circle cx="40" cy="42" r="1.2" fill="white" opacity="0.6" />
    </svg>
  );

  if (isLg) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-white"
        style={{
          width: px + 16,
          height: px + 16,
          boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
        }}
      >
        {star}
      </div>
    );
  }

  return star;
}
