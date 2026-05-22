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
  if (diff < 86400 * 30) return `hace ${Math.floor(diff / (86400 * 7))}sem`;
  if (diff < 86400 * 365) return `hace ${Math.floor(diff / (86400 * 30))}meses`;
  return `hace ${Math.floor(diff / (86400 * 365))}años`;
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
