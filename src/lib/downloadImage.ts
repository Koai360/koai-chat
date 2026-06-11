/**
 * downloadImage — guarda/comparte una imagen generada (S163).
 *
 * iOS PWA: el camino bueno es Web Share API con File → share sheet nativo →
 * "Guardar imagen" la manda a Fotos. Desktop: <a download> con blob.
 * Fallback final: abrir la imagen en pestaña nueva (long-press → guardar).
 */
import { fetchImageBlob } from "@/lib/api";

export type DownloadResult = "shared" | "downloaded" | "opened";

export async function downloadOrShareImage(
  url: string,
  filename?: string,
): Promise<DownloadResult> {
  const name =
    filename ||
    url.split("/").pop()?.split("?")[0] ||
    `noa-${Date.now()}.png`;

  let blob: Blob;
  try {
    blob = await fetchImageBlob(url);
  } catch {
    // Proxy caído / sin red → al menos abrir la imagen original
    window.open(url, "_blank", "noopener");
    return "opened";
  }

  const file = new File([blob], name, { type: blob.type || "image/png" });

  // iOS/Android: share sheet nativo (permite "Guardar imagen" → Fotos)
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (err) {
      // AbortError = el usuario cerró el sheet — no es fallo, no duplicar con download
      if ((err as DOMException)?.name === "AbortError") return "shared";
      // Otro error → caer al download clásico
    }
  }

  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
  return "downloaded";
}
