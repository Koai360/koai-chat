import { useState, useEffect } from "react";

export function OnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="flex items-center gap-1 mt-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
      <span className="text-[10px] text-amber-500 font-medium">Sin conexión</span>
    </div>
  );
}
