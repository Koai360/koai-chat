import { useEffect, useState } from "react";

/** Suscripción reactiva a una media query. SSR-safe (false sin window). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** ≥1280px: escritorio "de verdad" (mismo umbral que el sidebar anclado, S332). */
export const XL_QUERY = "(min-width: 1280px)";
