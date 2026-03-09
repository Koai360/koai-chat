import { useState, useEffect } from "react";
import { Wifi, WifiOff } from "lucide-react";

export function OnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) {
    return (
      <div className="flex items-center gap-1 text-[10px] text-kira">
        <Wifi className="w-3 h-3" />
        <span>Online</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-[10px] text-danger">
      <WifiOff className="w-3 h-3" />
      <span>Offline</span>
    </div>
  );
}
