import type {ApiAttendee, ApiCalendarListEntry, ApiEvent, ApiEventDateTime, CalEvent, Calendar, Guests, Meeting, NewEvent} from './types';

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

const ENTITIES: Record<string, string> = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '};

/** Google descriptions may be HTML: keep the text and its line breaks. */
export function stripHtml(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/?\s*(p|div|li|ul|ol|h[1-6]|tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
      if (name[0] === '#') {
        const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
      }
      return ENTITIES[name.toLowerCase()] ?? entity;
    })
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
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

export function mapGuests(attendees: readonly ApiAttendee[]): Guests | null {
  const people = attendees.filter(attendee => attendee.resource !== true);
  if (people.length === 0) return null;
  const count = (status: string) => people.filter(attendee => (attendee.responseStatus ?? 'needsAction') === status).length;
  return {
    total: people.length,
    accepted: count('accepted'),
    tentative: count('tentative'),
    declined: count('declined'),
    needsAction: count('needsAction'),
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
    guests: mapGuests(attendees),
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
