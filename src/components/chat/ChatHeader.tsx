import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoreVertical, CheckSquare, Trash2, X } from "lucide-react";

interface Props {
  title?: string;
  onSelectMode: () => void;
  onDelete: () => void;
}

export function ChatHeader({ title, onSelectMode, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-bg/80 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-text truncate flex-1 mr-2">
          {title || "Chat"}
        </h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-text-muted">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onSelectMode}>
              <CheckSquare className="h-3.5 w-3.5 mr-2" />
              Seleccionar mensajes
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Eliminar conversación
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Confirm delete dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-[300px]">
          <DialogHeader>
            <DialogTitle className="text-sm">¿Eliminar esta conversación?</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-text-muted">Esta acción no se puede deshacer.</p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" className="flex-1" onClick={() => { onDelete(); setConfirmDelete(false); }}>
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

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
