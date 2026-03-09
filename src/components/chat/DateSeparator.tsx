interface Props {
  label: string;
}

export function DateSeparator({ label }: Props) {
  return (
    <div className="flex items-center gap-3 my-4 px-2">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border-subtle to-transparent" />
      <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border-subtle to-transparent" />
    </div>
  );
}

export function formatDateLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hoy";
  if (date.toDateString() === yesterday.toDateString()) return "Ayer";
  return date.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
}

export function shouldShowDate(messages: { timestamp: number }[], index: number): boolean {
  if (index === 0) return true;
  const prev = new Date(messages[index - 1].timestamp).toDateString();
  const curr = new Date(messages[index].timestamp).toDateString();
  return prev !== curr;
}
