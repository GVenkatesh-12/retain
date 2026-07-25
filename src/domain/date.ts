export const DAY_MS = 86_400_000;

export function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function dateKeyFromParts(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseDateKey(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
}

export function addDaysToDateKey(key: string, days: number): string {
  const { year, month, day } = parseDateKey(key);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return dateKeyFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function localDateKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return dateKeyFromParts(Number(values.year), Number(values.month), Number(values.day));
}

/** An instant around local noon, which preserves the intended calendar date in normal IANA zones. */
export function dateKeyToInstant(key: string, timezone: string): string {
  const { year, month, day } = parseDateKey(key);
  let guess = new Date(Date.UTC(year, month - 1, day, 12));
  for (let i = 0; i < 3; i += 1) {
    const local = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(guess);
    const values = Object.fromEntries(local.map((part) => [part.type, part.value]));
    const localAsUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
    const desired = Date.UTC(year, month - 1, day, 12);
    guess = new Date(guess.getTime() + desired - localAsUtc);
  }
  return guess.toISOString();
}

export function formatDate(key: string, options?: Intl.DateTimeFormatOptions): string {
  const { year, month, day } = parseDateKey(key);
  if (options) {
    return new Intl.DateTimeFormat('en-GB', options).format(new Date(Date.UTC(year, month - 1, day, 12)));
  }
  const yy = String(year).slice(-2);
  return `${pad(day)}/${pad(month)}/${yy}`;
}

export function daysBetween(from: string, to: string): number {
  const a = parseDateKey(from);
  const b = parseDateKey(to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY_MS);
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}
