// The app's notion of "now". Demo mode and the end-to-end tests move it to a
// fixed moment (it keeps ticking from there); everything else uses the device clock.

let offsetMs = 0;

export function now(): Date {
  return new Date(Date.now() + offsetMs);
}

/** Makes `now()` read `moment` at this instant and keep running from there. */
export function setNow(moment: Date | null): void {
  offsetMs = moment == null ? 0 : moment.getTime() - Date.now();
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** The device's IANA time zone, sent to Google with every range and new event. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
