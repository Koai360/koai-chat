import { useState, useRef, useEffect, useCallback } from "react";
import type { Conversation } from "../hooks/useChat";
import type { AuthUser } from "../hooks/useAuth";
import { relativeTime } from "../lib/time";
import {
  fetchProjects,
  createProject,
  deleteProject,
  type ServerProject,
} from "../lib/api";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  user: AuthUser;
  onLogout: () => void;
  onOpenGallery?: () => void;
}

function haptic(ms = 8) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

export function ConversationList({ conversations, activeId, onSelect, onNew, onDelete, onClose, user, onLogout, onOpenGallery }: Props) {
  const [search, setSearch] = useState("");
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ServerProject[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const touchStartX = useRef(0);

  // Load projects
  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .catch((err) => console.error("[Projects] Error:", err));
  }, []);

  const filtered = search.trim()
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  // Group conversations by project
  const grouped = new Map<string | null, Conversation[]>();
  for (const c of filtered) {
    const key = c.projectId || null;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(c);
  }

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;
    try {
      const project = await createProject(newProjectName.trim());
      setProjects((prev) => [project, ...prev]);
      setNewProjectName("");
      setShowNewProject(false);
    } catch (err) {
      console.error("[Projects] Create error:", err);
    }
  }, [newProjectName]);

  const handleDeleteProject = useCallback(async (id: string) => {
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("[Projects] Delete error:", err);
    }
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent, id: string) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 80) {
      setSwipedId(id);
    } else if (diff < -40) {
      setSwipedId(null);
    }
  };

  const renderConvoItem = (c: Conversation) => (
    <div
      key={c.id}
      className="relative overflow-hidden rounded-xl mb-0.5"
      onTouchStart={handleTouchStart}
      onTouchEnd={(e) => handleTouchEnd(e, c.id)}
    >
      <div className={`absolute right-0 top-0 bottom-0 flex items-center transition-all ${swipedId === c.id ? "w-16" : "w-0"} overflow-hidden`}>
        <button
          onClick={(e) => { e.stopPropagation(); haptic(15); setConfirmDeleteId(c.id); setSwipedId(null); }}
          className="w-full h-full bg-red-500 flex items-center justify-center text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>

      <div
        onClick={() => { haptic(); onSelect(c.id); onClose(); setSwipedId(null); }}
        className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-all ${
          swipedId === c.id ? "-translate-x-16" : ""
        } ${
          c.id === activeId
            ? "bg-[#572c77]/10 dark:bg-[#572c77]/20"
            : "hover:bg-gray-50 dark:hover:bg-[#1a1a1e]"
        }`}
      >
        <div className="flex-1 min-w-0">
          <span className="text-sm text-gray-900 dark:text-gray-100 truncate block">
            {c.title}
          </span>
          <span className="text-[11px] text-gray-400">
            {relativeTime(c.createdAt)}
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); haptic(15); setConfirmDeleteId(c.id); }}
          className="ml-1 w-7 h-7 flex-shrink-0 flex items-center justify-center text-gray-300 hover:text-red-500 rounded-lg"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0a0a0c]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 safe-top">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Conversaciones</h2>
        <button onClick={onClose} className="w-11 h-11 flex items-center justify-center text-gray-500 hover:text-gray-700 rounded-xl">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Actions row */}
      <div className="flex gap-2 mx-4 mt-3 mb-2">
        <button
          onClick={() => { onNew(); onClose(); }}
          className="flex-1 py-2 rounded-xl border-2 border-dashed border-[#572c77]/30 dark:border-[#572c77]/40 text-xs font-medium text-[#572c77] dark:text-[#bcd431] hover:border-[#572c77]/60 transition-colors"
        >
          + Chat
        </button>
        <button
          onClick={() => setShowNewProject(true)}
          className="flex-1 py-2 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-[#572c77]/60 transition-colors"
        >
          + Proyecto
        </button>
      </div>

      {/* Search */}
      <div className="px-4 mb-2">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1a1a1e] pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#572c77]"
          />
        </div>
      </div>

      {/* Gallery button */}
      {onOpenGallery && (
        <button
          onClick={onOpenGallery}
          className="mx-4 mb-2 py-1.5 rounded-xl flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-[#572c77] dark:hover:text-[#bcd431] hover:bg-gray-50 dark:hover:bg-[#1a1a1e] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          Galería
        </button>
      )}

      {/* Conversations list grouped by projects */}
      <div className="flex-1 overflow-y-auto px-2">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-gray-400 mt-8">
            {search ? "Sin resultados" : "Sin conversaciones"}
          </p>
        ) : (
          <>
            {/* Project sections */}
            {projects.map((project) => {
              const projectConvos = grouped.get(project.id) || [];
              if (projectConvos.length === 0 && search.trim()) return null;
              const isCollapsed = collapsed[project.id];

              return (
                <div key={project.id} className="mb-2">
                  <div className="flex items-center">
                  <button
                    onClick={() => toggleCollapse(project.id)}
                    className="flex-1 flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  >
                    <svg
                      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      className={`transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                    <span>{project.icon}</span>
                    <span className="truncate">{project.name}</span>
                    <span className="text-gray-400 font-normal ml-auto">{projectConvos.length}</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}
                    className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 rounded transition-colors -ml-1 mr-1"
                    title="Eliminar proyecto"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                  </div>
                  {!isCollapsed && projectConvos.map(renderConvoItem)}
                  {!isCollapsed && projectConvos.length === 0 && (
                    <p className="text-[11px] text-gray-400 px-4 py-1">Sin conversaciones</p>
                  )}
                </div>
              );
            })}

            {/* General (no project) */}
            {(() => {
              const noProjectConvos = grouped.get(null) || [];
              if (noProjectConvos.length === 0) return null;
              const hasProjects = projects.length > 0;
              return (
                <div className="mb-2">
                  {hasProjects && (
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500">
                      General
                    </div>
                  )}
                  {noProjectConvos.map(renderConvoItem)}
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* New project input */}
      {showNewProject && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[60] animate-fade-in" onClick={() => setShowNewProject(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[70] bg-white dark:bg-[#1e1b22] rounded-2xl shadow-2xl p-5 animate-fade-in max-w-sm mx-auto">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Nuevo proyecto</h3>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
              placeholder="Nombre del proyecto"
              autoFocus
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1a1a1e] px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#572c77]/40 mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewProject(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-[#2c2c2e] active:scale-[0.98]"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!newProjectName.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-[#572c77] active:bg-[#3d1e54] active:scale-[0.98] disabled:opacity-50"
              >
                Crear
              </button>
            </div>
          </div>
        </>
      )}

      {/* Confirm delete modal */}
      {confirmDeleteId && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[60] animate-fade-in" onClick={() => setConfirmDeleteId(null)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[70] bg-white dark:bg-[#1e1b22] rounded-2xl shadow-2xl p-5 animate-fade-in max-w-sm mx-auto">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Eliminar conversación</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-[#2c2c2e] active:scale-[0.98]"
              >
                Cancelar
              </button>
              <button
                onClick={() => { haptic(15); onDelete(confirmDeleteId); setConfirmDeleteId(null); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 active:bg-red-600 active:scale-[0.98]"
              >
                Eliminar
              </button>
            </div>
          </div>
        </>
      )}

      {/* User footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between safe-bottom">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#572c77]/10 dark:bg-[#572c77]/30 flex items-center justify-center text-[#572c77] dark:text-[#bcd431] font-semibold text-sm">
            {user.name[0]}
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{user.name}</span>
        </div>
        <button
          onClick={onLogout}
          className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-xl"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
