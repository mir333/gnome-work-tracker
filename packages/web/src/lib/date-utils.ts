/** Format total minutes as "Xh Ym" */
export function formatHM(totalMins: number): string {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/** Get ISO date string (YYYY-MM-DD) for a Date */
export function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Get start of week (Monday) for a given date */
export function startOfWeek(d: Date): Date {
  const result = new Date(d);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Get end of week (Sunday 23:59:59) as start of next Monday */
export function endOfWeek(d: Date): Date {
  const start = startOfWeek(d);
  return addDays(start, 7);
}

/** Get start of month for a given date */
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Get end of month (start of next month) for a given date */
export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

/** Add N days to a date */
export function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

/** Check if two dates are the same calendar day */
export function isSameDay(a: Date, b: Date): boolean {
  return toDateString(a) === toDateString(b);
}

/** Get short day name (Mon, Tue, ...) */
export function shortDayName(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

/** Format date range for display */
export function formatDateRange(from: Date, to: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const fromStr = from.toLocaleDateString(undefined, opts);
  const toEnd = addDays(to, -1); // to is exclusive
  const toStr = toEnd.toLocaleDateString(undefined, {
    ...opts,
    year: "numeric",
  });
  return `${fromStr} – ${toStr}`;
}

/** Format month for display */
export function formatMonth(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** Add N months to a date */
export function addMonths(d: Date, n: number): Date {
  const result = new Date(d);
  result.setMonth(result.getMonth() + n);
  return result;
}
