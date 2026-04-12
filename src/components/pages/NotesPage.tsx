import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Loader2, StickyNote } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchNotes, createNote, updateNote, deleteNote, type Note } from "@/lib/api";

export function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Load notes
  useEffect(() => {
    fetchNotes()
      .then((data) => { setNotes(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Auto-save on blur or after 2s of no typing
  useEffect(() => {
    if (!dirty || !activeNote) return;
    const t = setTimeout(async () => {
      setSaving(true);
      try {
        await updateNote(activeNote.id, title, content);
        setNotes((prev) => prev.map((n) => n.id === activeNote.id ? { ...n, title, content, updated_at: new Date().toISOString() } : n));
      } catch { /* ignore */ }
      setSaving(false);
      setDirty(false);
    }, 1500);
    return () => clearTimeout(t);
  }, [dirty, title, content, activeNote]);

  const handleCreate = useCallback(async () => {
    try {
      const note = await createNote("Nueva nota", "");
      setNotes((prev) => [note, ...prev]);
      setActiveNote(note);
      setTitle(note.title);
      setContent(note.content);
      setDirty(false);
    } catch { /* ignore */ }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeNote?.id === id) { setActiveNote(null); setTitle(""); setContent(""); }
    await deleteNote(id).catch(() => {});
  }, [activeNote]);

  const selectNote = useCallback((note: Note) => {
    setActiveNote(note);
    setTitle(note.title);
    setContent(note.content);
    setDirty(false);
  }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return "Hoy";
    if (diff < 172800000) return "Ayer";
    return d.toLocaleDateString("es-ES", { month: "short", day: "numeric" });
  };

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Sidebar — lista de notas */}
      <div className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-border flex flex-col">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h1 className="text-lg font-display font-medium text-text">Notas</h1>
          <button
            onClick={handleCreate}
            className="w-8 h-8 rounded-lg bg-noa/10 hover:bg-noa/20 flex items-center justify-center transition-colors"
            aria-label="Nueva nota"
          >
            <Plus className="size-4 text-noa" />
          </button>
        </div>

        <ScrollArea className="flex-1 max-h-[200px] md:max-h-none">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-text-muted" />
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-text-muted">
              <StickyNote className="size-8 mb-2 opacity-40" />
              <p className="text-xs text-center">No hay notas aún</p>
              <button onClick={handleCreate} className="mt-2 text-xs text-noa hover:underline">
                Crear primera nota
              </button>
            </div>
          ) : (
            <div className="flex flex-row md:flex-col gap-1 px-2 pb-2 overflow-x-auto md:overflow-x-visible">
              {notes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => selectNote(note)}
                  className={`shrink-0 md:shrink text-left px-3 py-2 rounded-lg transition-all group ${
                    activeNote?.id === note.id
                      ? "bg-noa/10 border border-noa/20"
                      : "hover:bg-bg-surface border border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-text truncate max-w-[180px]">
                      {note.title || "Sin título"}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-text-muted hover:text-danger transition-all"
                      aria-label="Eliminar nota"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                  <p className="text-[10px] text-text-subtle font-mono mt-0.5">
                    {formatDate(note.updated_at)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeNote ? (
          <>
            <div className="flex items-center gap-2 px-4 pt-4 pb-2">
              <input
                value={title}
                onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
                placeholder="Título de la nota"
                className="flex-1 text-lg font-display font-medium text-text bg-transparent outline-none placeholder:text-text-subtle"
              />
              <AnimatePresence>
                {saving && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[10px] text-noa font-mono"
                  >
                    Guardando...
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <textarea
              value={content}
              onChange={(e) => { setContent(e.target.value); setDirty(true); }}
              placeholder="Escribe tu nota aquí..."
              className="flex-1 px-4 pb-4 text-sm text-text bg-transparent outline-none resize-none placeholder:text-text-subtle leading-relaxed"
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-text-muted">
            <StickyNote className="size-10 mb-3 opacity-30" />
            <p className="text-sm">Selecciona o crea una nota</p>
          </div>
        )}
      </div>
    </div>
  );
}
