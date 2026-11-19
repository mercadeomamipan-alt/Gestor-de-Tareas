// Todas las fechas "del día" se calculan en hora de Colombia, aunque el servidor esté en UTC.
export const TZ = "America/Bogota";

/** Fecha de hoy en Colombia, formato AAAA-MM-DD. */
export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function toUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Días desde hoy hasta la fecha (negativo si ya pasó). */
export function daysUntil(iso: string, today = todayISO()): number {
  return Math.round((toUTC(iso) - toUTC(today)) / 86400000);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(toUTC(iso) + n * 86400000);
  return d.toISOString().slice(0, 10);
}

/** Suma meses conservando el día cuando existe (31 ene + 1 mes = 28/29 feb). */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

export function isoWeek(iso: string): number {
  const t = new Date(toUTC(iso));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - y0) / 86400000 + 1) / 7);
}

function parts(iso: string, opts: Intl.DateTimeFormatOptions) {
  const p = new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", ...opts }).formatToParts(new Date(toUTC(iso)));
  const get = (t: string) => (p.find((x) => x.type === t)?.value ?? "").replace(/\./g, "");
  return get;
}

/** "mié 18 nov" */
export function fmtDay(iso: string): string {
  const g = parts(iso, { weekday: "short", day: "numeric", month: "short" });
  return `${g("weekday")} ${g("day")} ${g("month")}`;
}

/** "18 nov 2026" */
export function fmtDate(iso: string): string {
  const g = parts(iso, { day: "numeric", month: "short", year: "numeric" });
  return `${g("day")} ${g("month")} ${g("year")}`;
}

/** "18 nov · 3:45 p. m." (hora Colombia) */
export function fmtStamp(ts: string): string {
  const p = new Intl.DateTimeFormat("es-CO", {
    timeZone: TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  }).formatToParts(new Date(ts));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("day")} ${g("month").replace(/\./g, "")} · ${g("hour")}:${g("minute")} ${g("dayPeriod")}`.trim();
}

export function fmtLongToday(now = new Date()): string {
  return new Intl.DateTimeFormat("es-CO", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);
}

export type DueInfo = { text: string; tone: "late" | "soon" | "" };

export function dueInfo(iso: string | null, today = todayISO()): DueInfo {
  if (!iso) return { text: "Sin fecha", tone: "" };
  const n = daysUntil(iso, today);
  if (n < 0) return { text: `${fmtDay(iso)} · venció hace ${-n} d`, tone: "late" };
  if (n === 0) return { text: `Hoy · ${fmtDay(iso)}`, tone: "soon" };
  if (n === 1) return { text: `Mañana · ${fmtDay(iso)}`, tone: "soon" };
  if (n <= 7) return { text: `${fmtDay(iso)} · en ${n} d`, tone: "soon" };
  return { text: `${fmtDay(iso)} · sem ${isoWeek(iso)}`, tone: "" };
}

// ---------- Calendario (semanas de lunes a domingo) ----------

/** 0 = lunes … 6 = domingo */
export function weekdayIndex(iso: string): number {
  return (new Date(toUTC(iso)).getUTCDay() + 6) % 7;
}

export function startOfWeek(iso: string): string {
  return addDays(iso, -weekdayIndex(iso));
}

export function startOfMonth(iso: string): string {
  return iso.slice(0, 8) + "01";
}

export function endOfMonth(iso: string): string {
  return addDays(addMonths(startOfMonth(iso), 1), -1);
}

export function isValidISO(s: string | undefined | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUTC(s));
}

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", ...opts }).format(new Date(toUTC(iso)));

/** "noviembre de 2026" */
export const fmtMonthYear = (iso: string) => fmt(iso, { month: "long", year: "numeric" });
/** "lunes 16 de noviembre" */
export const fmtLongDay = (iso: string) => fmt(iso, { weekday: "long", day: "numeric", month: "long" });
/** "lun" */
export const fmtWeekdayShort = (iso: string) => fmt(iso, { weekday: "short" }).replace(/\./g, "");

/** "10:30:00" → "10:30 a. m." */
export function fmtTime(t: string | null | undefined): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "a. m." : "p. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** "10:00 a. m. – 11:30 a. m." o "Todo el día" */
export function fmtTimeRange(start: string | null, end: string | null): string {
  if (!start) return "Todo el día";
  return end ? `${fmtTime(start)} – ${fmtTime(end)}` : fmtTime(start);
}

/** Siguiente día de lunes a sábado después de la fecha dada. */
export function nextWorkday(iso: string): string {
  let d = addDays(iso, 1);
  if (weekdayIndex(d) === 6) d = addDays(d, 1);
  return d;
}
