/**
 * imageTransform — variantes optimizadas vía CF Image Transformations (S158-b).
 *
 * Las imágenes generadas se guardan en R2 como PNG lossless (multi-MB). El
 * chat/viewer NO debe bajar el original — usa /cdn-cgi/image/ con resize +
 * format=auto (webp/avif). Extraído de GalleryPage para reuso (MessageBubble,
 * ImageViewer). El original queda solo para descarga explícita.
 *
 * data: URLs y dominios desconocidos se devuelven intactos.
 */
export function cfImageVariant(url: string, width: number, quality = 85): string {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith("https://cdn.koai360.com/")) {
    // Idempotencia: no re-transformar una URL ya transformada
    if (url.includes("/cdn-cgi/image/")) return url;
    const rest = url.replace("https://cdn.koai360.com/", "");
    return `https://cdn.koai360.com/cdn-cgi/image/width=${width},quality=${quality},format=auto/${rest}`;
  }
  if (url.includes("/storage/v1/object/public/")) {
    // Supabase Storage legacy → render endpoint
    return url.replace(
      "/storage/v1/object/public/",
      `/storage/v1/render/image/public/?width=${width}&quality=${quality}&resize=contain&path=`,
    );
  }
  return url;
}
