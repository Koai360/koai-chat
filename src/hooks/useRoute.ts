import { useEffect, useState } from "react";
import { parseHash, type Route } from "@/lib/routing";

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const handler = () => setRoute(parseHash(window.location.hash));
    // hashchange: edición manual de URL / links externos.
    // popstate: back/forward sobre las entries de pushState.
    // noa:navigate: navigate() interno (pushState, ver routing.ts S161).
    window.addEventListener("hashchange", handler);
    window.addEventListener("popstate", handler);
    window.addEventListener("noa:navigate", handler);
    return () => {
      window.removeEventListener("hashchange", handler);
      window.removeEventListener("popstate", handler);
      window.removeEventListener("noa:navigate", handler);
    };
  }, []);

  return route;
}
