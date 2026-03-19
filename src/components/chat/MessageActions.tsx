import { useState } from "react";
import { ThumbsUp, ThumbsDown, RefreshCw, Copy, Check, MoreHorizontal } from "lucide-react";

interface Props {
  onThumbsUp?: () => void;
  onThumbsDown?: () => void;
  onRegenerate?: () => void;
  onCopy?: () => void;
  isLast?: boolean;
}

function ActionButton({
  icon: Icon,
  tooltip,
  onClick,
  active,
}: {
  icon: typeof ThumbsUp;
  tooltip: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${
        active
          ? "text-text"
          : "text-text-muted hover:text-text hover:bg-bg-surface"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

export function MessageActions({ onThumbsUp, onThumbsDown, onRegenerate, onCopy, isLast }: Props) {
  const [copied, setCopied] = useState(false);
  const [thumbState, setThumbState] = useState<"up" | "down" | null>(null);

  const handleCopy = () => {
    onCopy?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleThumbsUp = () => {
    setThumbState(thumbState === "up" ? null : "up");
    onThumbsUp?.();
  };

  const handleThumbsDown = () => {
    setThumbState(thumbState === "down" ? null : "down");
    onThumbsDown?.();
  };

  return (
    <div
      className={`flex items-center gap-0.5 mt-1 ${
        isLast ? "opacity-100" : "opacity-0 group-hover/msg:opacity-100"
      } transition-opacity`}
    >
      <ActionButton
        icon={ThumbsUp}
        tooltip="Good response"
        onClick={handleThumbsUp}
        active={thumbState === "up"}
      />
      <ActionButton
        icon={ThumbsDown}
        tooltip="Bad response"
        onClick={handleThumbsDown}
        active={thumbState === "down"}
      />
      {isLast && onRegenerate && (
        <ActionButton icon={RefreshCw} tooltip="Regenerate" onClick={onRegenerate} />
      )}
      <ActionButton
        icon={copied ? Check : Copy}
        tooltip="Copy"
        onClick={handleCopy}
        active={copied}
      />
      <ActionButton icon={MoreHorizontal} tooltip="More" />
    </div>
  );
}
