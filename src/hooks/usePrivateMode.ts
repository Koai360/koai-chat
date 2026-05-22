import { useCallback, useEffect, useState } from "react";
import { fetchPrivateStatus, verifyPrivatePin, setPrivatePin as apiSetPin } from "@/lib/api";

const SESSION_KEY = "noa.private-unlocked";
const SYNC_EVENT = "noa:private-mode-changed";

/**
 * Hook para gestionar la galería privada (PIN bcrypt en backend).
 *
 * - hasPin: PIN configurado en el servidor
 * - isUnlocked: sesión actual desbloqueada (sessionStorage)
 * - unlock(pin): verifica y desbloquea
 * - lock(): bloquea (limpia sessionStorage)
 * - setPin(pin, oldPin?): configura o cambia PIN
 *
 * Sincronización entre instancias del mismo tab via CustomEvent
 * — el evento 'storage' nativo solo dispara cross-tab.
 */
export function usePrivateMode() {
  const [hasPin, setHasPin] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY) === "true",
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrivateStatus()
      .then((s) => setHasPin(s.has_pin))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Sync entre instancias del hook (Settings + Gallery)
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ unlocked: boolean }>).detail;
      setIsUnlocked(detail.unlocked);
    };
    window.addEventListener(SYNC_EVENT, onChange);
    return () => window.removeEventListener(SYNC_EVENT, onChange);
  }, []);

  const broadcast = (unlocked: boolean) => {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { unlocked } }));
  };

  const refreshStatus = useCallback(async () => {
    try {
      const s = await fetchPrivateStatus();
      setHasPin(s.has_pin);
    } catch {
      // silent
    }
  }, []);

  const unlock = useCallback(async (pin: string): Promise<boolean> => {
    const ok = await verifyPrivatePin(pin);
    if (ok) {
      sessionStorage.setItem(SESSION_KEY, "true");
      setIsUnlocked(true);
      broadcast(true);
    }
    return ok;
  }, []);

  const lock = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setIsUnlocked(false);
    broadcast(false);
  }, []);

  const setPin = useCallback(async (pin: string, oldPin?: string) => {
    await apiSetPin(pin, oldPin);
    setHasPin(true);
  }, []);

  return { hasPin, isUnlocked, loading, unlock, lock, setPin, refreshStatus };
}
