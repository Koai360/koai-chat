import { useCallback, useEffect, useRef } from "react";

/**
 * useModalBack — integra un modal/lightbox con el historial de navegación.
 *
 * S164: en la PWA standalone iOS el gesto de "atrás" (edge-swipe) dispara
 * popstate. Sin entry propio, el gesto navegaba la app (o no hacía nada) en
 * vez de cerrar el visor → "no puedo volver atrás". Con este hook:
 *   - al montar: pushState con el MISMO hash (useRoute re-parsea la misma
 *     ruta → no-op, no rompe el routing S161 de pushState + noa:navigate)
 *   - gesto atrás / popstate → onClose()
 *   - cierre manual (X, backdrop, Escape) → history.back() para consumir el
 *     entry propio y no dejar basura en el historial
 *
 * Devuelve `close` — usarlo SIEMPRE en lugar de onClose directo.
 */
export function useModalBack(onClose: () => void): () => void {
  const pushedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    history.pushState({ noaModal: true }, "", window.location.hash || "#/");
    pushedRef.current = true;

    const onPop = () => {
      pushedRef.current = false;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Unmount sin pasar por close() (p.ej. cambio de conversación):
      // consumir el entry para que el próximo "atrás" no sea un no-op.
      if (pushedRef.current) {
        pushedRef.current = false;
        history.back();
      }
    };
  }, []);

  return useCallback(() => {
    if (pushedRef.current) {
      // El popstate resultante dispara onClose
      history.back();
    } else {
      onCloseRef.current();
    }
  }, []);
}
