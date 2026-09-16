import { useEffect, useState } from "react";
import { getNoaFlags } from "@/lib/api";

/**
 * useNoaFlags — flags server-side por usuario (S322).
 *
 * El backend evalúa la allowlist por JWT (`noa_feature_flags`), así que la UI sólo
 * pregunta "¿esta función está para mí?". Cache en módulo con el TTL que manda el
 * server (60 s) y refetch al volver a primer plano si venció. Sin flags cargados
 * todo es `false`: una función nueva nunca aparece antes de tiempo.
 */
let cache: { at: number; ttl: number; flags: Record<string, boolean> } | null = null;
let inflight: Promise<Record<string, boolean>> | null = null;

async function load(force = false): Promise<Record<string, boolean>> {
  if (!force && cache && Date.now() - cache.at < cache.ttl * 1000) return cache.flags;
  if (inflight) return inflight;
  inflight = getNoaFlags()
    .then((r) => {
      cache = { at: Date.now(), ttl: Math.max(15, r.ttl || 60), flags: r.flags || {} };
      return cache.flags;
    })
    .catch(() => cache?.flags ?? {})
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useNoaFlags(): { flags: Record<string, boolean>; loaded: boolean } {
  const [flags, setFlags] = useState<Record<string, boolean>>(() => cache?.flags ?? {});
  const [loaded, setLoaded] = useState<boolean>(() => cache !== null);

  useEffect(() => {
    let alive = true;
    const run = (force = false) =>
      void load(force).then((f) => {
        if (!alive) return;
        setFlags(f);
        setLoaded(true);
      });
    run();
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return { flags, loaded };
}
