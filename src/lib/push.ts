import { API_URL, getAuthToken } from "../config";

function getHeaders(): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

/** Convierte VAPID public key de base64url a Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** Solicita permiso + suscribe + envía al backend */
export async function requestPushPermission(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.log("[Push] Not supported");
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.log("[Push] Permission denied");
    return false;
  }

  try {
    // Obtener VAPID public key del servidor
    const keyResp = await fetch(`${API_URL}/api/push/vapid-key`);
    const { publicKey } = await keyResp.json();

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    const subJson = subscription.toJSON();

    // Enviar subscription al backend
    const resp = await fetch(`${API_URL}/api/push/subscribe`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      }),
    });

    if (!resp.ok) throw new Error(`Subscribe failed: ${resp.status}`);

    console.log("[Push] Subscribed successfully");
    return true;
  } catch (err) {
    console.error("[Push] Subscribe error:", err);
    return false;
  }
}

/** Verifica si ya está suscrito */
export async function isPushSubscribed(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}
