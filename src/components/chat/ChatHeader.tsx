import { Button } from "@/components/ui/button";
import { Trash2, X } from "lucide-react";

export function SelectModeHeader({
  count,
  onCancel,
  onDeleteSelected,
}: {
  count: number;
  onCancel: () => void;
  onDeleteSelected: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-bg/80 backdrop-blur-sm">
      <Button variant="ghost" size="icon" className="h-7 w-7 text-text-muted" onClick={onCancel}>
        <X className="h-4 w-4" />
      </Button>
      <span className="text-sm text-text-muted">
        {count} seleccionado{count !== 1 ? "s" : ""}
      </span>
      <Button
        variant="destructive"
        size="sm"
        className="h-7 text-xs"
        disabled={count === 0}
        onClick={onDeleteSelected}
      >
        <Trash2 className="h-3 w-3 mr-1" />
        Eliminar
      </Button>
    </div>
  );
}
