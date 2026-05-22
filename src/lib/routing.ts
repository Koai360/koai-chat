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
  window.location.hash = routeToHash(route);
}
