/** Group Norwegian trip history by the Oslo calendar, independent of device timezone. */
export function osloDay(value: string | number | Date): string | null {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-CA', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit' }) : null;
}
export function osloWeekStart(now = Date.now()): string {
  const day = osloDay(now)!;
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}
export function thisOsloWeek(value: string, now = Date.now()): boolean {
  const day = osloDay(value);
  return day !== null && day >= osloWeekStart(now) && day <= osloDay(now)!;
}
