/**
 * Format helpers — money, time, números, etc.
 */

export function formatMoney(value: number | undefined | null, opts: { sign?: boolean } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = opts.sign && value > 0 ? "+" : "";
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
  }).format(value);
  return sign + formatted;
}

export function formatCompact(value: number | undefined | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatNumber(value: number | undefined | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

/**
 * Relative time: "hace 2h", "hace 3d", "ayer", "hoy".
 */
export function relativeTime(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const now = Date.now();
  const diff = (now - date.getTime()) / 1000; // segundos

  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 2) return "ayer";
  if (diff < 86400 * 7) return `hace ${Math.floor(diff / 86400)}d`;
  if (diff < 86400 * 30) return `hace ${Math.floor(diff / (86400 * 7))} sem`;
  if (diff < 86400 * 365) {
    const m = Math.floor(diff / (86400 * 30));
    return `hace ${m} ${m === 1 ? "mes" : "meses"}`;
  }
  const y = Math.floor(diff / (86400 * 365));
  return `hace ${y} ${y === 1 ? "año" : "años"}`;
}

/**
 * Convierte UTC ISO → string en hora Miami con formato corto.
 */
export function formatMiamiTime(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

const DAY_ES: Record<string, string> = {
  monday: "lunes", tuesday: "martes", wednesday: "miércoles", thursday: "jueves",
  friday: "viernes", saturday: "sábado", sunday: "domingo",
};

/** Patrón de recurrencia del servidor (`daily_0800`, `weekly_monday_0900`, `every_2h`…) en español. */
export function describePattern(pattern: string | undefined): string {
  if (!pattern) return "";
  if (pattern.startsWith("daily_")) {
    const hhmm = pattern.slice(6);
    const hh = hhmm.slice(0, 2);
    const mm = hhmm.slice(2, 4);
    return `Cada día a las ${hh}:${mm}`;
  }
  if (pattern.startsWith("weekly_")) {
    const parts = pattern.split("_");
    const day = DAY_ES[parts[1]?.toLowerCase() ?? ""] ?? parts[1];
    return `Cada ${day} a las ${parts[2]?.slice(0, 2)}:${parts[2]?.slice(2, 4)}`;
  }
  if (pattern.startsWith("monthly_")) {
    const parts = pattern.split("_");
    return `Día ${parts[1]} de cada mes a las ${parts[2]?.slice(0, 2)}:${parts[2]?.slice(2, 4)}`;
  }
  if (pattern.startsWith("every_") && pattern.endsWith("h")) {
    const n = pattern.slice(6, -1);
    return `Cada ${n} hora${n !== "1" ? "s" : ""}`;
  }
  if (pattern.startsWith("every_") && pattern.endsWith("min")) {
    const n = pattern.slice(6, -3);
    return `Cada ${n} minuto${n !== "1" ? "s" : ""}`;
  }
  return pattern;
}
