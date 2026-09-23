/**
 * FileAttachments — archivos que Noa entregó en un mensaje (S338, ADR 0063).
 *
 * El mensaje NO trae URLs: cada vista o descarga pide con la sesión una URL firmada de
 * 10 min (POST /api/chat/files/{id}/url). Así un archivo de un cliente o un PDF nunca
 * queda público ni pegado en el historial.
 *
 * - Imágenes: miniatura (URL inline) → tap abre el lightbox existente.
 * - PDF / texto: "Ver" abre el archivo en pestaña nueva (inline); "Descargar" lo baja.
 * - Resto: sólo "Descargar" (el servidor fuerza attachment: nada se ejecuta en el navegador).
 */
import { memo, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Download, Eye, FileText, File as FileIcon, FileArchive, FileAudio, FileVideo, Loader2 } from "lucide-react";
import { ImageLightbox } from "@/components/shared/ImageLightbox";
import { getChatFileUrl } from "@/lib/api";
import type { ChatAttachment } from "@/types/api";

const VIEWABLE = new Set(["application/pdf", "text/plain"]);

function formatSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(mime: string) {
  if (mime === "application/pdf" || mime.startsWith("text/")) return FileText;
  if (mime.startsWith("audio/")) return FileAudio;
  if (mime.startsWith("video/")) return FileVideo;
  if (mime.includes("zip") || mime.includes("compressed")) return FileArchive;
  return FileIcon;
}

/**
 * Abre la URL firmada en otra pestaña. La ventana se abre SINCRÓNICAMENTE en el click y
 * recién después se le asigna la URL: si se abre tras el await, Safari lo toma como popup
 * no pedido y lo bloquea.
 */
async function openSigned(fileId: string, inline: boolean): Promise<void> {
  const win = window.open("", "_blank");
  try {
    const { url } = await getChatFileUrl(fileId, inline);
    if (win) win.location.href = url;
    else window.location.href = url;
  } catch (err) {
    win?.close();
    throw err;
  }
}

function ImageAttachment({ file, onOpen }: { file: ChatAttachment; onOpen: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    getChatFileUrl(file.file_id, true)
      .then((r) => alive && setUrl(r.url))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [file.file_id]);

  if (failed) {
    return <FileCard file={file} />;
  }
  return (
    <button
      type="button"
      onClick={() => url && onOpen(url)}
      className="block aspect-square w-full overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] cursor-zoom-in"
      aria-label={`Ver ${file.name}`}
    >
      {url ? (
        <img src={url} alt={file.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-white/40">
          <Loader2 size={18} className="animate-spin" />
        </span>
      )}
    </button>
  );
}

function FileCard({ file }: { file: ChatAttachment }) {
  const [busy, setBusy] = useState<"view" | "download" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const Icon = iconFor(file.mime);
  const canView = VIEWABLE.has(file.mime) || file.kind === "image";

  const act = async (mode: "view" | "download") => {
    setError(null);
    setBusy(mode);
    try {
      await openSigned(file.file_id, mode === "view");
    } catch {
      setError("No pude abrir el archivo. Probá de nuevo.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[var(--color-bg-elevated)] px-3 py-2.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-white/70">
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-white/90" title={file.name}>
          {file.name}
        </p>
        <p className="text-[12px] text-white/45">
          {[file.mime === "application/pdf" ? "PDF" : file.mime.split("/")[1]?.toUpperCase(), formatSize(file.size)]
            .filter(Boolean)
            .join(" · ")}
          {error && <span className="ml-2 text-amber-200/80">{error}</span>}
        </p>
      </div>
      {canView && (
        <button
          type="button"
          onClick={() => act("view")}
          disabled={busy !== null}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/70 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
          aria-label={`Ver ${file.name}`}
          title="Ver"
        >
          {busy === "view" ? <Loader2 size={17} className="animate-spin" /> : <Eye size={17} />}
        </button>
      )}
      <button
        type="button"
        onClick={() => act("download")}
        disabled={busy !== null}
        className="flex h-10 w-10 items-center justify-center rounded-full text-white/70 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
        aria-label={`Descargar ${file.name}`}
        title="Descargar"
      >
        {busy === "download" ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
      </button>
    </div>
  );
}

export const FileAttachments = memo(function FileAttachments({ files }: { files: ChatAttachment[] }) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const images = files.filter((f) => f.kind === "image");
  const others = files.filter((f) => f.kind !== "image");

  return (
    <div className="space-y-2 max-w-[480px]">
      {images.length > 0 && (
        <div className={images.length === 1 ? "max-w-[320px]" : "grid grid-cols-2 gap-2 sm:grid-cols-3"}>
          {images.map((f) => (
            <ImageAttachment key={f.file_id} file={f} onOpen={setLightboxUrl} />
          ))}
        </div>
      )}
      {others.map((f) => (
        <FileCard key={f.file_id} file={f} />
      ))}
      <AnimatePresence>
        {lightboxUrl && <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
      </AnimatePresence>
    </div>
  );
});
