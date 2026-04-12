import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Image, CalendarClock, StickyNote, Star, Loader2 } from "lucide-react";
import { API_URL, getAuthToken } from "@/config";

interface DashboardStats {
  conversations_total: number;
  conversations_week: number;
  images_week: number;
  tasks_pending: number;
  tasks_completed: number;
  notes_total: number;
  avg_rating: number;
  daily_activity: { date: string; count: number }[];
  top_engines: { engine: string; count: number }[];
}

function StatCard({ label, value, icon: Icon, color, delay }: {
  label: string;
  value: string | number;
  icon: typeof MessageSquare;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border border-border bg-bg-surface p-4"
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="size-4" style={{ color }} />
        </div>
        <div>
          <p className="text-2xl font-display font-semibold text-text" style={{ letterSpacing: "-0.02em" }}>
            {value}
          </p>
          <p className="text-[10px] font-mono text-text-muted uppercase tracking-wide">{label}</p>
        </div>
      </div>
    </motion.div>
  );
}

function ActivityChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="rounded-xl border border-border bg-bg-surface p-4"
    >
      <p className="text-xs font-mono text-text-muted uppercase tracking-wide mb-4">
        Actividad (7 días)
      </p>
      <div className="flex items-end gap-2 h-28">
        {data.map((d, i) => {
          const height = d.count > 0 ? Math.max((d.count / max) * 100, 8) : 4;
          const dayName = days[new Date(d.date + "T12:00:00").getDay()];
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] font-mono text-text-muted">{d.count || ""}</span>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ delay: 0.4 + i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="w-full rounded-t-md"
                style={{
                  backgroundColor: d.count > 0 ? "#D4E94B" : "rgba(255,255,255,0.06)",
                  opacity: d.count > 0 ? 0.8 + (d.count / max) * 0.2 : 1,
                }}
              />
              <span className="text-[9px] font-mono text-text-subtle">{dayName}</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function EngineChart({ data }: { data: { engine: string; count: number }[] }) {
  if (data.length === 0) return null;
  const total = data.reduce((s, d) => s + d.count, 0);
  const colors = ["#D4E94B", "#00E5FF", "#E5A3F0", "#FFA726", "#EF5350"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.4 }}
      className="rounded-xl border border-border bg-bg-surface p-4"
    >
      <p className="text-xs font-mono text-text-muted uppercase tracking-wide mb-3">
        Top engines
      </p>
      <div className="space-y-2">
        {data.map((d, i) => {
          const pct = total > 0 ? (d.count / total) * 100 : 0;
          return (
            <div key={d.engine} className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-text-muted w-20 truncate">{d.engine}</span>
              <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: 0.5 + i * 0.08, duration: 0.6 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: colors[i % colors.length] }}
                />
              </div>
              <span className="text-[10px] font-mono text-text-subtle w-8 text-right">{d.count}</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    else headers["X-API-Key"] = "koai-dev-2026";

    fetch(`${API_URL}/api/dashboard/stats`, { headers })
      .then((r) => r.json())
      .then((data) => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
        Error cargando dashboard
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-display font-medium text-text mb-4"
        style={{ letterSpacing: "-0.02em" }}
      >
        Dashboard
      </motion.h1>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <StatCard label="Conversaciones" value={stats.conversations_total} icon={MessageSquare} color="#D4E94B" delay={0.05} />
        <StatCard label="Esta semana" value={stats.conversations_week} icon={MessageSquare} color="#00E5FF" delay={0.1} />
        <StatCard label="Imágenes (7d)" value={stats.images_week} icon={Image} color="#E5A3F0" delay={0.15} />
        <StatCard label="Tareas pendientes" value={stats.tasks_pending} icon={CalendarClock} color="#FFA726" delay={0.2} />
        <StatCard label="Tareas hechas" value={stats.tasks_completed} icon={CalendarClock} color="#4CAF50" delay={0.25} />
        <StatCard label="Notas" value={stats.notes_total} icon={StickyNote} color="#FFEE58" delay={0.3} />
      </div>

      {/* Rating promedio */}
      {stats.avg_rating > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex items-center gap-2 mb-4 px-1"
        >
          <Star className="size-4 text-noa" fill="#D4E94B" />
          <span className="text-sm text-text font-medium">{stats.avg_rating}</span>
          <span className="text-[10px] text-text-muted font-mono">rating promedio</span>
        </motion.div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {stats.daily_activity.length > 0 && (
          <ActivityChart data={stats.daily_activity} />
        )}
        <EngineChart data={stats.top_engines} />
      </div>
    </div>
  );
}
