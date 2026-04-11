import { useState, useEffect, useCallback } from "react";
import { fetchPrivateStatus, verifyPrivatePin, setPrivatePin as apiSetPin } from "@/lib/api";

const SESSION_KEY = "koai-private-unlocked";

/**
 * Hook para gestionar el modo privado de la galería.
 *
 * - `hasPin`: si el usuario tiene PIN configurado en el backend
 * - `isUnlocked`: si la sesión actual está desbloqueada (sessionStorage)
 * - `unlock(pin)`: verifica PIN con backend, desbloquea si correcto
 * - `lock()`: bloquea la sesión (limpia sessionStorage)
 * - `setPin(pin, oldPin?)`: configura o cambia el PIN
 * - `refreshStatus()`: re-fetch del estado del PIN
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
    }
    return ok;
  }, []);

  const lock = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setIsUnlocked(false);
  }, []);

  const setPin = useCallback(async (pin: string, oldPin?: string) => {
    await apiSetPin(pin, oldPin);
    setHasPin(true);
  }, []);

  return { hasPin, isUnlocked, loading, unlock, lock, setPin, refreshStatus };
}
