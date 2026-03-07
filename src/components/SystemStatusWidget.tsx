import { useState, useEffect, useRef, useCallback } from "react";
import type { SystemStatus } from "../lib/api";
import { fetchSystemStatus } from "../lib/api";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  return `${hours}h`;
}

function dotColor(status: string): string {
  if (status === "active" || status === "running") return "bg-green-500";
  if (status === "stopped" || status === "failed" || status === "error") return "bg-red-500";
  return "bg-gray-500";
}

export function SystemStatusWidget() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadStatus = useCallback(() => {
    fetchSystemStatus()
      .then((s) => { setStatus(s); setError(false); })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 60_000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const apiStatus = status?.services?.koai_api || "unknown";
  const tunnelStatus = status?.services?.cloudflared || "unknown";
  const hasIssue = status
    ? Object.values(status.services).some((s) => s !== "active" && s !== "running")
    : false;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Compact widget button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-white/10 transition-colors"
        title="System Status"
      >
        {error ? (
          <>
            <span className="w-2 h-2 rounded-full bg-gray-500" />
            <span className="w-2 h-2 rounded-full bg-gray-500" />
          </>
        ) : (
          <>
            <span className={`w-2 h-2 rounded-full ${dotColor(apiStatus)}`} />
            <span className={`w-2 h-2 rounded-full ${dotColor(tunnelStatus)}`} />
          </>
        )}
        {/* Red badge if any service is down */}
        {hasIssue && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
        )}
      </button>

      {/* Expanded dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-[#2a2a2a] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <h3 className="text-sm font-semibold text-gray-100">System Status</h3>
          </div>

          {error || !status ? (
            <div className="px-4 py-4 text-center">
              <p className="text-xs text-gray-400">No se pudo obtener el estado</p>
            </div>
          ) : (
            <>
              {/* VPS metrics */}
              <div className="px-4 py-3 grid grid-cols-2 gap-y-2 gap-x-4 text-xs border-b border-white/10">
                <div>
                  <span className="text-gray-400">CPU: </span>
                  <span className="text-gray-100 font-medium">{status.vps.cpu_percent}%</span>
                </div>
                <div>
                  <span className="text-gray-400">RAM: </span>
                  <span className="text-gray-100 font-medium">
                    {status.vps.ram_used_gb}/{status.vps.ram_total_gb} GB
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Disk: </span>
                  <span className="text-gray-100 font-medium">
                    {status.vps.disk_used_gb}/{status.vps.disk_total_gb} GB
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Uptime: </span>
                  <span className="text-gray-100 font-medium">{Math.round(status.vps.uptime_hours)}h</span>
                </div>
              </div>

              {/* Services */}
              <div className="px-4 py-3 border-b border-white/10">
                <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-2">Services</p>
                <div className="space-y-1.5">
                  {Object.entries(status.services).map(([name, svcStatus]) => (
                    <div key={name} className="flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor(svcStatus)}`} />
                      <span className="text-gray-300 flex-1">{name.replace("_", " ")}</span>
                      <span className={`font-medium ${svcStatus === "active" || svcStatus === "running" ? "text-green-400" : "text-red-400"}`}>
                        {svcStatus}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Last check */}
              <div className="px-4 py-2">
                <p className="text-[11px] text-gray-500">
                  Last check: {timeAgo(status.last_checked)}
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
