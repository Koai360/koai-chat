import { useState, useEffect, useRef, useCallback } from "react";
import { fetchImages, deleteImage, type GalleryImage } from "../lib/api";

interface Props {
  onClose: () => void;
  onImageClick?: (src: string) => void;
}

function imageSrcFromBase64(base64: string): string {
  const mime = base64.startsWith("iVBOR") ? "image/png"
    : base64.startsWith("R0lGOD") ? "image/gif"
    : base64.startsWith("UklGR") ? "image/webp"
    : "image/jpeg";
  return `data:${mime};base64,${base64}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH < 1) return "Hace un momento";
  if (diffH < 24) return `Hace ${Math.floor(diffH)}h`;
  if (diffH < 48) return "Ayer";
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
}

export function ImageGallery({ onClose, onImageClick }: Props) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [deleting, setDeleting] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchImages()
      .then(setImages)
      .catch((err) => console.error("[ImageGallery] Error:", err))
      .finally(() => setLoading(false));
  }, []);

  // Close context menu on outside tap
  useEffect(() => {
    if (!menuId) return;
    const handle = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-context-menu]")) {
        setMenuId(null);
      }
    };
    document.addEventListener("mousedown", handle);
    document.addEventListener("touchstart", handle);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("touchstart", handle);
    };
  }, [menuId]);

  const handleLongPressStart = useCallback((id: string, clientX: number, clientY: number) => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      if (navigator.vibrate) navigator.vibrate(20);
      // Position menu relative to scroll container
      const rect = scrollRef.current?.getBoundingClientRect();
      const x = clientX - (rect?.left ?? 0);
      const y = clientY - (rect?.top ?? 0) + (scrollRef.current?.scrollTop ?? 0);
      setMenuPos({ x, y });
      setMenuId(id);
    }, 500);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTap = useCallback((_id: string, src: string) => {
    if (didLongPress.current) return;
    if (menuId) {
      setMenuId(null);
    } else {
      onImageClick?.(src);
    }
  }, [menuId, onImageClick]);

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(true);
    try {
      await deleteImage(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
      setMenuId(null);
    } catch (err) {
      console.error("[ImageGallery] Delete error:", err);
    } finally {
      setDeleting(false);
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-[#171717]">
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center text-[#9b9b9b] hover:text-[#ececec] rounded-xl active:scale-95 transition-all"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="font-semibold text-[#ececec] text-base">Galería</h2>
          {!loading && images.length > 0 && (
            <p className="text-[11px] text-[#9b9b9b] -mt-0.5">
              {images.length} {images.length === 1 ? "imagen" : "imágenes"}
            </p>
          )}
        </div>
        {menuId && (
          <button
            onClick={() => setMenuId(null)}
            className="text-xs text-[#9b9b9b] px-3 py-1.5 rounded-full bg-white/[0.06] active:scale-95"
          >
            Cancelar
          </button>
        )}
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[#171717] relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <svg className="animate-spin w-7 h-7 text-[#57C74A]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-[#9b9b9b]">Cargando galería...</p>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-[#2f2f2f] flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#9b9b9b]">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[#9b9b9b]">No hay imágenes aún</p>
            <p className="text-xs text-[#9b9b9b]/60 mt-1">Pídele a Kira que genere una imagen</p>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 p-3">
            {images.map((img) => {
              const src = imageSrcFromBase64(img.image);
              return (
                <div
                  key={img.id}
                  data-gallery-item
                  className="relative mb-3 break-inside-avoid group/card"
                  onTouchStart={(e) => {
                    const t = e.touches[0];
                    handleLongPressStart(img.id, t.clientX, t.clientY);
                  }}
                  onTouchEnd={handleLongPressEnd}
                  onTouchCancel={handleLongPressEnd}
                  onMouseDown={(e) => handleLongPressStart(img.id, e.clientX, e.clientY)}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                  onClick={() => handleTap(img.id, src)}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <div className="rounded-2xl overflow-hidden border border-white/[0.06] transition-transform duration-300 hover:scale-[1.03]">
                    <img
                      src={src}
                      alt="Imagen generada"
                      className="w-full block"
                      loading="lazy"
                      draggable={false}
                    />
                    {/* Overlay with date + engine badge */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent pt-8 pb-2 px-2.5 pointer-events-none rounded-b-2xl">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-white/80 font-medium">{formatDate(img.created_at)}</p>
                        {img.engine && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-[#57C74A]/20 text-[#57C74A]">
                            {img.engine}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Context menu */}
        {menuId && (
          <div
            data-context-menu
            className="absolute z-50 animate-fade-in"
            style={{
              left: `${Math.min(menuPos.x, (scrollRef.current?.clientWidth ?? 200) - 160)}px`,
              top: `${menuPos.y}px`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="bg-[#2f2f2f] rounded-xl shadow-2xl border border-white/[0.06] overflow-hidden min-w-[140px]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(menuId);
                }}
                disabled={deleting}
                className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-white/5 active:bg-white/10 transition-colors disabled:opacity-50"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span className="text-sm font-medium">Eliminar</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
