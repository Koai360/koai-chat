import { useState, useEffect, useCallback } from "react";
import { fetchPrivateStatus, verifyPrivatePin, setPrivatePin as apiSetPin } from "@/lib/api";

const SESSION_KEY = "koai-private-unlocked";
const SYNC_EVENT = "koai-private-mode-change";

/**
 * Hook para gestionar el modo privado de la galería.
 *
 * Todas las instancias del hook se sincronizan entre sí via custom event
 * (porque el `storage` event nativo solo dispara entre pestañas distintas,
 * no entre componentes en la misma pestaña).
 */
export function usePrivateMode() {
  const [hasPin, setHasPin] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === "true",
  );
  const [loading, setLoading] = useState(true);

  // Fetch status on mount
  useEffect(() => {
    fetchPrivateStatus()
      .then((s) => setHasPin(s.has_pin))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Sincronizar entre instancias del hook
  useEffect(() => {
    const handler = (e: Event) => {
      const { unlocked, hasPin: newHasPin } = (e as CustomEvent<{ unlocked?: boolean; hasPin?: boolean }>).detail || {};
      if (typeof unlocked === "boolean") setIsUnlocked(unlocked);
      if (typeof newHasPin === "boolean") setHasPin(newHasPin);
    };
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await fetchPrivateStatus();
      setHasPin(s.has_pin);
    } catch {
      // silencioso
    }
  }, []);

  const unlock = useCallback(async (pin: string): Promise<boolean> => {
    const ok = await verifyPrivatePin(pin);
    if (ok) {
      sessionStorage.setItem(SESSION_KEY, "true");
      setIsUnlocked(true);
      window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { unlocked: true } }));
    }
    return ok;
  }, []);

  const lock = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setIsUnlocked(false);
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { unlocked: false } }));
  }, []);

  const setPin = useCallback(async (pin: string, oldPin?: string) => {
    await apiSetPin(pin, oldPin);
    setHasPin(true);
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { hasPin: true } }));
  }, []);

  return { hasPin, isUnlocked, loading, unlock, lock, setPin, refreshStatus };
}
