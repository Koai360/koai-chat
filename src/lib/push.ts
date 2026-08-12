/**
 * Web Push — suscripción del cliente.
 *
 * S232: el backend ya tenía TODO (claves VAPID en .env, /api/push/subscribe,
 * /api/push/send, tabla push_subscriptions) y el service worker ya escuchaba el
 * evento `push` con showNotification... pero nadie llamaba nunca a
 * `pushManager.subscribe()`. El botón de Ajustes sólo pedía el permiso del
 * sistema, que por sí solo no registra ningún endpoint: sin endpoint el backend
 * no tiene a dónde empujar y el handler del SW jamás se dispara. De ahí que no
 * llegara una sola notificación. Este módulo cierra ese eslabón.
 *
 * iOS: Web Push exige iOS 16.4+ **y la PWA instalada en pantalla de inicio**.
 * En Safari normal `PushManager` ni siquiera existe — por eso distinguimos el
 * caso "no soportado" del caso "instalala primero", que tiene arreglo.
 */

import {
  deletePushSubscription,
  getVapidKey,
  savePushSubscription,
} from "@/lib/api";

export type PushSupport =
  | { ok: true }
  | { ok: false; reason: "install-first" | "unsupported" };

export interface PushState {
  permission: NotificationPermission;
  subscribed: boolean;
}

function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ se reporta como Mac con touch
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** ¿Corriendo como app instalada (pantalla de inicio) y no como pestaña? */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function checkPushSupport(): PushSupport {
  const hasApi =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof Notification !== "undefined";
  if (hasApi) return { ok: true };
  // En iOS la API aparece SOLO cuando la PWA está instalada: si no está, el
  // problema no es el dispositivo sino que falta añadirla a pantalla de inicio.
  if (isIos() && !isStandalone()) return { ok: false, reason: "install-first" };
  return { ok: false, reason: "unsupported" };
}

export async function getPushState(): Promise<PushState> {
  const permission =
    typeof Notification !== "undefined" ? Notification.permission : "denied";
  if (checkPushSupport().ok !== true || permission !== "granted") {
    return { permission, subscribed: false };
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return { permission, subscribed: sub !== null };
  } catch {
    return { permission, subscribed: false };
  }
}

/**
 * Pide permiso, se suscribe y registra el endpoint en el backend.
 * Debe invocarse desde un gesto del usuario (iOS lo exige para el permiso).
 */
export async function enablePush(): Promise<PushState> {
  const support = checkPushSupport();
  if (!support.ok) {
    throw new Error(
      support.reason === "install-first"
        ? "En iPhone, primero añadí Noa a la pantalla de inicio (Compartir → Añadir a inicio) y abrila desde ahí."
        : "Este navegador no soporta notificaciones push.",
    );
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notificaciones bloqueadas. Activalas en los ajustes del navegador."
        : "Permiso de notificaciones no concedido.",
    );
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();

  if (!sub) {
    const vapidKey = await getVapidKey();
    sub = await reg.pushManager.subscribe({
      // Obligatorio en Chrome e iOS: cada push muestra una notificación visible.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });
  }

  // Re-registrar aunque la suscripción ya existiera: Apple rota el endpoint y
  // el backend puede tener guardado uno muerto.
  await savePushSubscription(sub.toJSON());
  return { permission, subscribed: true };
}

export async function disablePush(): Promise<PushState> {
  const permission =
    typeof Notification !== "undefined" ? Notification.permission : "denied";
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      // Primero el backend: si `unsubscribe()` corriera antes y el DELETE
      // fallara, quedaría una fila huérfana imposible de limpiar (ya no
      // tendríamos el endpoint).
      await deletePushSubscription(sub.toJSON()).catch(() => {});
      await sub.unsubscribe();
    }
  } catch {
    /* sin SW listo no hay nada que desuscribir */
  }
  return { permission, subscribed: false };
}

/** VAPID viaja en base64url; `pushManager.subscribe` quiere bytes crudos. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
