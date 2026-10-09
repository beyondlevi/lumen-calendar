// Demo mode: fictional calendars (fixtures.json, also served by the e2e mock)
// placed around today, with saves and replies kept in memory. No network.
import type {CalendarBackend, Reply} from '../google/client';
import {attendeesWithReply, dateOnly, mapCalendars, mapEvent, newEventBody} from '../google/mapping';
import type {ApiCalendarListEntry, ApiEvent, CalEvent, Calendar, NewEvent} from '../google/types';
import fixtures from './fixtures.json';

type FixtureEvent = Omit<ApiEvent, 'start' | 'end'> & {
  calendarId: string;
  day: number;
  start?: string;
  end?: string;
  allDayDays?: number;
  mockOnly?: boolean;
};

function at(dayStart: Date, day: number, time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + day, hours, minutes).toISOString();
}

function onDay(dayStart: Date, day: number): string {
  return dateOnly(new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + day));
}

/** The fixtures as Google would send them, with `today` starting at `dayStart`. */
export function fixtureEvents(dayStart: Date, includeMockOnly = false): (ApiEvent & {calendarId: string})[] {
  return (fixtures.events as FixtureEvent[])
    .filter(event => includeMockOnly || event.mockOnly !== true)
    .map(({day, start, end, allDayDays, mockOnly: _mockOnly, ...event}) => ({
      ...event,
      start: allDayDays ? {date: onDay(dayStart, day)} : {dateTime: at(dayStart, day, start ?? '09:00')},
      end: allDayDays ? {date: onDay(dayStart, day + allDayDays)} : {dateTime: at(dayStart, day, end ?? '10:00')},
    }));
}

const LATENCY_MS = 250;

const wait = () => new Promise(resolve => setTimeout(resolve, LATENCY_MS));

export class DemoBackend implements CalendarBackend {
  private readonly events: (ApiEvent & {calendarId: string})[];
  private created = 0;

  constructor(
    dayStart: Date,
    private readonly timeZone: string,
    private readonly noTitle: string,
  ) {
    this.events = fixtureEvents(dayStart);
  }

  async listCalendars(): Promise<Calendar[]> {
    await wait();
    return mapCalendars(fixtures.calendars as ApiCalendarListEntry[]);
  }

  async listEvents(calendar: Calendar, timeMin: Date, timeMax: Date): Promise<CalEvent[]> {
    await wait();
    return this.events
      .filter(event => event.calendarId === calendar.id)
      .map(event => mapEvent(event, calendar, this.noTitle))
      .filter((event): event is CalEvent => event != null && event.start < timeMax && event.end > timeMin)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  async insertEvent(calendar: Calendar, event: NewEvent): Promise<CalEvent> {
    await wait();
    this.created += 1;
    const created = {...(newEventBody(event, this.timeZone) as Omit<ApiEvent, 'id'>), id: `evdemo${this.created}`, calendarId: calendar.id};
    this.events.push(created);
    const mapped = mapEvent(created, calendar, this.noTitle);
    if (!mapped) throw new Error('unreadable');
    return mapped;
  }

  async reply(event: CalEvent, calendar: Calendar, response: Reply): Promise<CalEvent> {
    await wait();
    const stored = this.events.find(entry => entry.id === event.id && entry.calendarId === calendar.id);
    if (!stored) throw new Error('not found');
    stored.attendees = attendeesWithReply(stored.attendees ?? [], response);
    const mapped = mapEvent(stored, calendar, this.noTitle);
    if (!mapped) throw new Error('unreadable');
    return mapped;
  }
}
