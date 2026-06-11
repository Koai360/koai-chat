/**
 * Hash routing minimal — sin React Router (overkill para 4 surfaces).
 *
 * Rutas reconocidas:
 *   #/                     → chat empty
 *   #/c/{id}               → chat conversación
 *   #/galeria              → galería
 *   #/historial            → historial
 *   #/config              → settings root
 *   #/config/{tab}        → settings tab específica (memoria/kb/voz/...)
 */

export type Route =
  | { kind: "chat"; conversationId?: string }
  | { kind: "galeria" }
  | { kind: "historial" }
  | { kind: "config"; tab?: string };

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, "");
  const [head, ...rest] = clean.split("/");

  if (!head || head === "") return { kind: "chat" };

  if (head === "c" && rest[0]) {
    return { kind: "chat", conversationId: rest[0] };
  }

  if (head === "galeria") return { kind: "galeria" };
  if (head === "historial") return { kind: "historial" };

  if (head === "config") {
    return { kind: "config", tab: rest[0] };
  }

  return { kind: "chat" };
}

export function routeToHash(route: Route): string {
  switch (route.kind) {
    case "chat":
      return route.conversationId ? `#/c/${route.conversationId}` : "#/";
    case "galeria":
      return "#/galeria";
    case "historial":
      return "#/historial";
    case "config":
      return route.tab ? `#/config/${route.tab}` : "#/config";
  }
}

export function navigate(route: Route): void {
  const hash = routeToHash(route);
  if (window.location.hash === hash) return;
  // S161: en PWA standalone iOS, asignar location.hash cuenta como
  // "navegación" y RESETEA el permiso de micrófono de la sesión (WebKit
  // bug 215884, sin fix) → el mic re-pedía permiso tras cada cambio de
  // conversación. pushState actualiza la URL SIN navegar → el permiso
  // otorgado se conserva durante toda la sesión. pushState no emite
  // hashchange, así que avisamos con un evento propio (useRoute escucha
  // hashchange + popstate + noa:navigate).
  history.pushState(null, "", hash);
  window.dispatchEvent(new Event("noa:navigate"));
}
