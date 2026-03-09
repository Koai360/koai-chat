import { useState, useEffect, useCallback } from "react";
import type { SystemStatus } from "@/lib/api";
import { fetchSystemStatus } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { X, RefreshCw, Server, Cpu, HardDrive, MemoryStick, Clock, Wifi, WifiOff } from "lucide-react";

interface Props {
  onClose: () => void;
}

function dotColor(status: string): string {
  if (status === "active" || status === "running") return "bg-kira";
  if (status === "stopped" || status === "failed" || status === "error") return "bg-destructive";
  return "bg-text-muted";
}

function statusLabel(status: string): string {
  if (status === "active" || status === "running") return "Activo";
  if (status === "stopped") return "Detenido";
  if (status === "failed" || status === "error") return "Error";
  return status;
}

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

export function SystemStatusPanel({ onClose }: Props) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadStatus = useCallback(() => {
    setLoading(true);
    fetchSystemStatus()
      .then((s) => { setStatus(s); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 60_000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle safe-top">
        <h2 className="text-base font-semibold text-text">System Status</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-text-muted" onClick={loadStatus}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-text-muted" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading && !status ? (
          <div className="px-4 py-4 space-y-4">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : error || !status ? (
          <div className="flex flex-col items-center justify-center h-32 px-8 text-center">
            <WifiOff className="h-8 w-8 text-text-muted/30 mb-2" />
            <p className="text-sm text-text-muted">No se pudo obtener el estado</p>
            <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={loadStatus}>
              Reintentar
            </Button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* VPS Metrics */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border-subtle bg-bg-surface/50 p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <Server className="h-4 w-4 text-kronos" />
                <h3 className="text-sm font-medium text-text">VPS</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  icon={<Cpu className="h-3.5 w-3.5" />}
                  label="CPU"
                  value={`${status.vps.cpu_percent}%`}
                  percent={status.vps.cpu_percent}
                />
                <MetricCard
                  icon={<MemoryStick className="h-3.5 w-3.5" />}
                  label="RAM"
                  value={`${status.vps.ram_used_gb}/${status.vps.ram_total_gb} GB`}
                  percent={(status.vps.ram_used_gb / status.vps.ram_total_gb) * 100}
                />
                <MetricCard
                  icon={<HardDrive className="h-3.5 w-3.5" />}
                  label="Disco"
                  value={`${status.vps.disk_used_gb}/${status.vps.disk_total_gb} GB`}
                  percent={(status.vps.disk_used_gb / status.vps.disk_total_gb) * 100}
                />
                <MetricCard
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label="Uptime"
                  value={`${Math.round(status.vps.uptime_hours)}h`}
                />
              </div>
            </motion.div>

            {/* Services */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-xl border border-border-subtle bg-bg-surface/50 p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <Wifi className="h-4 w-4 text-kira" />
                <h3 className="text-sm font-medium text-text">Servicios</h3>
              </div>

              <div className="space-y-2">
                {Object.entries(status.services).map(([name, svcStatus]) => (
                  <div key={name} className="flex items-center gap-2.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor(svcStatus)}`} />
                    <span className="text-xs text-text flex-1 capitalize">{name.replace(/_/g, " ")}</span>
                    <span className={`text-[11px] font-medium ${
                      svcStatus === "active" || svcStatus === "running" ? "text-kira" : "text-destructive"
                    }`}>
                      {statusLabel(svcStatus)}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Last check */}
            <p className="text-[11px] text-text-muted text-center">
              Última verificación: {timeAgo(status.last_checked)}
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  percent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  percent?: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-text-muted">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-semibold text-text">{value}</p>
      {percent !== undefined && (
        <div className="h-1 rounded-full bg-bg-sidebar overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              percent > 80 ? "bg-destructive" : percent > 60 ? "bg-yellow-500" : "bg-kira"
            }`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
