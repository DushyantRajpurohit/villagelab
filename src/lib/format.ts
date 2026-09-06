/** Shared display formatting. Kept framework-free so tests can cover it. */

export function fmtResource(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2).replace(/\.?0+$/, '')}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k`;
  return String(Math.round(v));
}

export function fmtDuration(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours)) return '—';
  if (hours === 0) return 'instant';
  const total = Math.round(hours * 60);
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m && !d) parts.push(`${m}m`);
  return parts.join(' ') || '0m';
}

export const fmtInt = (v: number | null | undefined): string =>
  v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('en-US');

/** The API uses a compact ISO variant: 20240115T103000.000Z */
export function parseCocDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(s);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtRelative(when: string | Date | null | undefined, now = Date.now()): string {
  const d = typeof when === 'string' ? parseCocDate(when) : when ?? null;
  if (!d || Number.isNaN(d.getTime())) return '—';
  const diff = d.getTime() - now;
  const mins = Math.round(Math.abs(diff) / 60_000);
  const unit = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
  return diff >= 0 ? `in ${unit}` : `${unit} ago`;
}
