import {formatTag, locale, t, tp, translate, translatePlural, type Locale} from '../i18n/strings';
import {addDays, sameDay, startOfDay} from './clock';

const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(tag: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${tag}|${JSON.stringify(options)}`;
  let value = cache.get(key);
  if (value == null) {
    value = new Intl.DateTimeFormat(tag, options);
    cache.set(key, value);
  }
  return value;
}

/** "15:00" (24-hour locales) or "3:00 PM". */
export function formatTime(date: Date, tag: string = formatTag()): string {
  return formatter(tag, {hour: 'numeric', minute: '2-digit'}).format(date);
}

export function formatTimeRange(start: Date, end: Date, tag: string = formatTag()): string {
  return t('timeRange', {start: formatTime(start, tag), end: formatTime(end, tag)});
}

/** "Fri 10" */
export function formatShortDay(date: Date, tag: string = formatTag()): string {
  return formatter(tag, {weekday: 'short', day: 'numeric'}).format(date);
}

/** "Oct 11" */
export function formatMonthDay(date: Date, tag: string = formatTag()): string {
  return formatter(tag, {month: 'short', day: 'numeric'}).format(date);
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

/** "Saturday" */
export function formatWeekday(date: Date, tag: string = formatTag()): string {
  return capitalize(formatter(tag, {weekday: 'long'}).format(date));
}

/** A day heading in the week: "Tomorrow · Fri 10", "Saturday · Oct 11". */
export function weekDayHeading(day: Date, today: Date, tag: string = formatTag()): string {
  if (sameDay(day, addDays(startOfDay(today), 1))) {
    return t('pair', {first: t('tomorrow'), second: formatShortDay(day, tag)});
  }
  return t('pair', {first: formatWeekday(day, tag), second: formatMonthDay(day, tag)});
}

/** The day of an event relative to today: "Today", "Tomorrow", "Saturday, Oct 11". */
export function relativeDay(day: Date, today: Date, tag: string = formatTag()): string {
  if (sameDay(day, today)) return t('today');
  if (sameDay(day, addDays(startOfDay(today), 1))) return t('tomorrow');
  return formatter(tag, {weekday: 'long', month: 'short', day: 'numeric'}).format(day).replace(/^./, c => c.toLocaleUpperCase());
}

/** The day with its date, as the Review screen shows it: "Tomorrow, Fri 10". */
export function dayWithDate(day: Date, today: Date, tag: string = formatTag()): string {
  if (sameDay(day, today)) return t('todayWithDate', {date: formatShortDay(day, tag)});
  if (sameDay(day, addDays(startOfDay(today), 1))) return t('tomorrowWithDate', {date: formatShortDay(day, tag)});
  return capitalize(formatter(tag, {weekday: 'short', month: 'short', day: 'numeric'}).format(day));
}

/** "25 min", "2 h", "1 h 20 min" for a positive number of minutes. */
export function shortDuration(minutes: number, target: Locale = locale): string {
  const whole = Math.max(1, Math.round(minutes));
  if (whole < 60) return translatePlural(target, 'minutesShort', whole);
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest === 0 ? translatePlural(target, 'hoursShort', hours) : translate(target, 'hoursMinutesShort', {hours, minutes: rest});
}

/**
 * How soon an event starts: "in 25 min", "now" while it runs, or null once it
 * is over or when it starts on another day.
 */
export function startsIn(start: Date, end: Date, current: Date): string | null {
  if (current >= end) return null;
  if (current >= start) return t('now');
  if (!sameDay(start, current)) return null;
  return t('inTime', {time: shortDuration((start.getTime() - current.getTime()) / 60000)});
}

export function guestsCount(count: number): string {
  return tp('guests', count);
}
