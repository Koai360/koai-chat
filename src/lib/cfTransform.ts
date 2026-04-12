/**
 * Cloudflare Transformations URL builder.
 *
 * Genera URLs transformadas con parámetros de resize/quality/format=auto
 * sin pre-computar versiones. CF cachea cada transformación única en edge.
 *
 * Arquitectura:
 *   - Origen: R2 bucket koai-media → https://cdn.koai360.com/noa/{file}.png
 *   - CDN: CF Transformations en zone koai360.com
 *   - URL pattern: https://{host}/cdn-cgi/image/{params}/{origin_url}
 *
 * Plan Free: 5,000 transformaciones únicas/mes. Después $0.50/1K.
 * Docs: https://developers.cloudflare.com/images/transform-images/
 *
 * Creado 2026-04-09 — migración de Supabase Storage transformations a CF.
 */

/**
 * Host desde donde se sirven las transformaciones. Debe ser un hostname
 * dentro del zone koai360.com con Transformations habilitado.
 * Usamos chat.koai360.com porque ya es el mismo origen del PWA
 * (evita CORS y problemas de DNS apex).
 */
const CF_TRANSFORM_HOST = "chat.koai360.com";

export type ImageVariant = "thumb" | "preview" | "fullscreen" | "hd" | "4k";

/**
 * Parámetros CF Transformations por variante.
 * format=auto → CF negotia WebP/AVIF según Accept header del browser.
 */
const VARIANT_PARAMS: Record<ImageVariant, string> = {
  // Galería grid — fast loading, small payload
  thumb: "width=600,quality=85,format=auto",
  // Chat bubble — nítido pero liviano
  preview: "width=1200,quality=90,format=auto",
  // Viewer fullscreen — alta calidad
  fullscreen: "width=2048,quality=95,format=auto",
  // HD download (alias de fullscreen)
  hd: "width=2048,quality=95,format=auto",
  // 4K download — máxima res transformada
  "4k": "width=4096,quality=95,format=auto",
};

/**
 * Hosts permitidos como origen para las transformaciones.
 * Evita que terceros abusen del endpoint /cdn-cgi/image/.
 */
const ALLOWED_ORIGINS = [
  "https://cdn.koai360.com/",
  // Durante migración Supabase → R2, también aceptamos Supabase temporalmente
  "https://refnipatiiyddkuxjqaf.supabase.co/",
];

/**
 * Construye URL de CF Transformations para una imagen.
 *
 * Si la URL no está en la whitelist de orígenes permitidos, devuelve
 * la original sin transformar (evita romper la app si hay URLs legacy).
 *
 * @param originalUrl URL del asset (ej https://cdn.koai360.com/noa/xxx.png)
 * @param variant     Preset de tamaño/calidad
 * @returns URL transformada, o la original si no está en whitelist
 */
export function getCfTransformUrl(
  originalUrl: string | null | undefined,
  variant: ImageVariant,
): string {
  if (!originalUrl) return "";

  // Solo transformar URLs conocidas
  const isAllowed = ALLOWED_ORIGINS.some((prefix) => originalUrl.startsWith(prefix));
  if (!isAllowed) return originalUrl;

  const params = VARIANT_PARAMS[variant];
  return `https://${CF_TRANSFORM_HOST}/cdn-cgi/image/${params}/${originalUrl}`;
}

/**
 * Para download original sin transformación: usa la URL directa.
 * El navegador hace fetch a R2 custom domain (cacheado por CF edge).
 *
 * Úsalo en el menú "Descargar Original" — devuelve el PNG lossless nativo.
 */
export function getOriginalUrl(originalUrl: string | null | undefined): string {
  return originalUrl || "";
}

/**
 * Helper para descargar programáticamente (botón download con filename custom).
 * Genera un link temporal y dispara el click.
 */
export async function triggerDownload(url: string, filename?: string): Promise<void> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || `koai-${Date.now()}.png`;
    a.style.position = "fixed";
    a.style.left = "-9999px";
    a.style.opacity = "0";
    document.body.appendChild(a);
    a.click();
    // Delay cleanup para que el browser procese el click
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    }, 100);
  } catch {
    // Fallback: abrir en nueva pestaña en vez de navegar away
    window.open(url, "_blank", "noopener");
  }
}
