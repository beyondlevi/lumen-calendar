import type {ApiAttendee, ApiCalendarListEntry, ApiEvent, ApiEventDateTime, CalEvent, Calendar, Guest, Guests, Meeting, NewEvent, ResponseStatus} from './types';

const DEFAULT_COLOR = '#2694fe';
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function mapCalendar(entry: ApiCalendarListEntry): Calendar {
  const color = entry.backgroundColor && HEX_COLOR.test(entry.backgroundColor) ? entry.backgroundColor.toLowerCase() : DEFAULT_COLOR;
  return {
    id: entry.id,
    name: (entry.summaryOverride || entry.summary || entry.id).trim(),
    color,
    primary: entry.primary === true,
    writable: entry.accessRole === 'owner' || entry.accessRole === 'writer',
    selected: entry.selected === true,
  };
}

/** Primary first, then Google's order. */
export function mapCalendars(entries: readonly ApiCalendarListEntry[]): Calendar[] {
  const calendars = entries.filter(entry => entry.deleted !== true && entry.id).map(mapCalendar);
  return [...calendars.filter(calendar => calendar.primary), ...calendars.filter(calendar => !calendar.primary)];
}

/** `2026-10-11` → local midnight of that day. */
export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function parseWhen(value: ApiEventDateTime | undefined): {date: Date; allDay: boolean} | null {
  if (value?.dateTime) {
    const date = new Date(value.dateTime);
    return Number.isNaN(date.getTime()) ? null : {date, allDay: false};
  }
  if (value?.date) {
    const date = parseDateOnly(value.date);
    return date ? {date, allDay: true} : null;
  }
  return null;
}

const ENTITIES: Record<string, string> = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0'};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }
    return ENTITIES[name.toLowerCase()] ?? entity;
  });
}

/** Placeholders while converting HTML: the edge of a block, and of a paragraph. */
const BLOCK = '\u0001';
const PARAGRAPH = '\u0002';
const TAG = /<\/?[a-z][a-z0-9]*\b[^>]*>/gi;
const HTML_HINT = /<(?:br|p|div|span|a|b|i|u|em|strong|ul|ol|li|h[1-6]|table|tr|td)\b[^>]*>/i;

/** A link as text: its words, then the address when the words aren't the address itself. */
function linkText(href: string, inner: string): string {
  let target = decodeEntities(href).trim();
  // Google wraps links in its redirector: show where they go.
  const redirect = /^https?:\/\/(?:www\.)?google\.com\/url\?(.*)$/i.exec(target);
  if (redirect) target = new URLSearchParams(redirect[1]).get('q') ?? target;
  target = target.replace(/^mailto:/i, '');
  const words = decodeEntities(inner.replace(TAG, '')).replace(/\s+/g, ' ').trim();
  if (!words) return target;
  const bare = (value: string) => value.replace(/^[a-z]+:\/\//i, '').replace(/\/$/, '').toLowerCase();
  return !target || bare(words) === bare(target) ? words : `${words} (${target})`;
}

/**
 * Google descriptions are plain text or HTML (from Calendar's editor): keep the
 * text, its line breaks and blank lines between paragraphs, lists as bullets
 * and links as text.
 */
export function stripHtml(description: string): string {
  let text = description.replace(/\r\n?/g, '\n');
  if (HTML_HINT.test(text)) {
    text = text
      // In HTML a line break in the source is a space.
      .replace(/\n/g, ' ')
      .replace(/<a\b[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a\s*>/gi, (_match, quoted, single, bare, inner: string) =>
        linkText(quoted ?? single ?? bare ?? '', inner),
      )
      // An empty line of Calendar's editor, then a <br> that only ends its block (browsers don't show it).
      .replace(/<div\b[^>]*>\s*<br\s*\/?>\s*<\/div\s*>/gi, PARAGRAPH)
      .replace(/<br\s*\/?>\s*(?=<\/(?:div|p|li)\s*>)/gi, '')
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, `${BLOCK}• `)
      .replace(/<\/?(?:li|div|tr|ul|ol|h[1-6])\b[^>]*>/gi, BLOCK)
      .replace(/<\/?p\b[^>]*>/gi, PARAGRAPH)
      .replace(TAG, '')
      // Block edges become one line break, paragraph edges a blank line, <br> as many as there are.
      .replace(/[\n\u0001\u0002 ]*[\u0001\u0002][\n\u0001\u0002 ]*/g, run => {
        const breaks = (run.match(/\n/g) ?? []).length;
        return '\n'.repeat(Math.max(breaks, run.includes(PARAGRAPH) ? 2 : 1));
      });
  }
  return decodeEntities(text)
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function displayAddress(uri: string): string {
  return uri.replace(/^[a-z]+:\/\//i, '').replace(/^tel:/i, '').replace(/\/$/, '');
}

export function mapMeeting(event: ApiEvent): Meeting | null {
  const entryPoints = event.conferenceData?.entryPoints ?? [];
  const video = entryPoints.find(point => point.entryPointType === 'video' && point.uri);
  const solution = event.conferenceData?.conferenceSolution?.name?.trim();
  if (video?.uri) {
    return {kind: solution || 'Google Meet', address: displayAddress(video.uri)};
  }
  if (event.hangoutLink) {
    return {kind: solution || 'Google Meet', address: displayAddress(event.hangoutLink)};
  }
  if (solution) {
    const other = entryPoints.find(point => point.uri);
    return {kind: solution, address: other?.uri ? displayAddress(other.uri) : null};
  }
  return null;
}

/** "Ana Souza" → "AS", "marco@example.com" → "M". */
export function initialsOf(name: string): string {
  const words = name.replace(/@.*$/, '').split(/[\s._-]+/).filter(Boolean);
  const letters = (words.length > 1 ? [words[0], words[words.length - 1]] : words.slice(0, 1)).map(word => [...word][0] ?? '');
  return letters.join('').toLocaleUpperCase() || '?';
}

const RESPONSES: readonly ResponseStatus[] = ['accepted', 'tentative', 'declined', 'needsAction'];
const RESPONSE_ORDER: Record<ResponseStatus, number> = {accepted: 0, tentative: 1, needsAction: 2, declined: 3};

export function mapGuest(attendee: ApiAttendee): Guest {
  const email = attendee.email?.trim() || null;
  const name = attendee.displayName?.trim() || email || '?';
  const response = RESPONSES.includes(attendee.responseStatus as ResponseStatus) ? (attendee.responseStatus as ResponseStatus) : 'needsAction';
  return {name, email, initials: initialsOf(name), response, organizer: attendee.organizer === true, self: attendee.self === true};
}

function compareGuests(a: Guest, b: Guest): number {
  const rank = (guest: Guest) => (guest.organizer ? 0 : guest.self ? 1 : 2);
  return rank(a) - rank(b) || RESPONSE_ORDER[a.response] - RESPONSE_ORDER[b.response] || a.name.localeCompare(b.name);
}

export function mapGuests(attendees: readonly ApiAttendee[], omitted = false): Guests | null {
  const people = attendees.filter(attendee => attendee.resource !== true).map(mapGuest).sort(compareGuests);
  if (people.length === 0) return null;
  const count = (status: ResponseStatus) => people.filter(guest => guest.response === status).length;
  return {
    total: people.length,
    accepted: count('accepted'),
    tentative: count('tentative'),
    declined: count('declined'),
    needsAction: count('needsAction'),
    people,
    omitted,
  };
}

/** Null for a cancelled or unreadable event. */
export function mapEvent(event: ApiEvent, calendar: Calendar, noTitle: string): CalEvent | null {
  if (event.status === 'cancelled') return null;
  const start = parseWhen(event.start);
  const end = parseWhen(event.end);
  if (!start) return null;
  const allDay = start.allDay;
  let endDate = end?.date ?? null;
  if (endDate == null || endDate <= start.date) {
    endDate = allDay
      ? new Date(start.date.getFullYear(), start.date.getMonth(), start.date.getDate() + 1)
      : new Date(start.date.getTime() + 60 * 60 * 1000);
  }
  const attendees = event.attendees ?? [];
  const self = attendees.find(attendee => attendee.self === true);
  const description = event.description ? stripHtml(event.description) : '';
  return {
    id: event.id,
    calendarId: calendar.id,
    calendarName: calendar.name,
    color: calendar.color,
    title: event.summary?.trim() || noTitle,
    allDay,
    start: start.date,
    end: endDate,
    location: event.location?.trim() || null,
    meeting: mapMeeting(event),
    guests: mapGuests(attendees, event.attendeesOmitted === true),
    selfResponse: self ? (self.responseStatus ?? 'needsAction') : null,
    description: description || null,
    attendees,
  };
}

/** All-day first, then by start, then by title. */
export function compareEvents(a: CalEvent, b: CalEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime() || a.title.localeCompare(b.title);
}

/** True when the event takes part of the day that starts at `dayStart`. */
export function overlapsDay(event: CalEvent, dayStart: Date): boolean {
  const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1);
  return event.start < dayEnd && event.end > dayStart;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function dateOnly(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The events.insert body. */
export function newEventBody(event: NewEvent, timeZone: string): Record<string, unknown> {
  const when = (date: Date) => (event.allDay ? {date: dateOnly(date)} : {dateTime: date.toISOString(), timeZone});
  const body: Record<string, unknown> = {summary: event.title, start: when(event.start), end: when(event.end)};
  if (event.location) body.location = event.location;
  return body;
}

/** The attendee list with the owner's answer changed, for events.patch. */
export function attendeesWithReply(attendees: readonly ApiAttendee[], response: 'accepted' | 'tentative' | 'declined'): ApiAttendee[] {
  return attendees.map(attendee => (attendee.self === true ? {...attendee, responseStatus: response} : attendee));
}
