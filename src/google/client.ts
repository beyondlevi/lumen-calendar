import {CalendarError, asCalendarError, errorFromResponse} from './errors';
import {attendeesWithReply, mapCalendars, mapEvent, newEventBody} from './mapping';
import type {TokenSource} from './oauth';
import type {ApiCalendarList, ApiCalendarListEntry, ApiEvent, ApiEvents, CalEvent, Calendar, NewEvent} from './types';

export const GOOGLE_API_BASE = 'https://www.googleapis.com/calendar/v3';

export type Reply = 'accepted' | 'tentative' | 'declined';

/** What the screens need from a calendar account: Google's, or the demo's. */
export interface CalendarBackend {
  listCalendars(): Promise<Calendar[]>;
  listEvents(calendar: Calendar, timeMin: Date, timeMax: Date): Promise<CalEvent[]>;
  insertEvent(calendar: Calendar, event: NewEvent): Promise<CalEvent>;
  reply(event: CalEvent, calendar: Calendar, response: Reply): Promise<CalEvent>;
}

const MAX_PAGES = 5;

type RequestOptions = {method?: 'GET' | 'POST' | 'PATCH'; query?: Record<string, string>; body?: unknown};

/**
 * Google Calendar API v3, called from the page. Only `Authorization` and
 * `Content-Type` are sent: any other header fails Google's CORS preflight.
 */
export class GoogleCalendarClient implements CalendarBackend {
  constructor(
    private readonly tokens: TokenSource,
    private readonly timeZone: string,
    private readonly noTitle: string,
    private readonly apiBase: string = GOOGLE_API_BASE,
    private readonly fetchImpl: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  private async send(path: string, token: string, options: RequestOptions): Promise<Response> {
    const url = new URL(`${this.apiBase}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value);
    const headers: Record<string, string> = {Authorization: `Bearer ${token}`};
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    try {
      return await this.fetchImpl(url.toString(), {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch (error) {
      throw asCalendarError(error);
    }
  }

  /** One call; on a 401 the token is renewed once and the call repeated once. */
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    let token = await this.tokens.get();
    let response = await this.send(path, token, options);
    if (response.status === 401) {
      this.tokens.invalidate(token);
      token = await this.tokens.refresh();
      response = await this.send(path, token, options);
    }
    if (!response.ok) {
      throw await errorFromResponse(response);
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new CalendarError('server', response.status, 'unreadable');
    }
  }

  async listCalendars(): Promise<Calendar[]> {
    const entries: ApiCalendarListEntry[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const query: Record<string, string> = {maxResults: '250'};
      if (pageToken) query.pageToken = pageToken;
      const data = await this.request<ApiCalendarList>('/users/me/calendarList', {query});
      entries.push(...(data.items ?? []));
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
    return mapCalendars(entries);
  }

  async listEvents(calendar: Calendar, timeMin: Date, timeMax: Date): Promise<CalEvent[]> {
    const events: CalEvent[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const query: Record<string, string> = {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        timeZone: this.timeZone,
        maxResults: '250',
      };
      if (pageToken) query.pageToken = pageToken;
      const data = await this.request<ApiEvents>(`/calendars/${encodeURIComponent(calendar.id)}/events`, {query});
      for (const item of data.items ?? []) {
        const event = mapEvent(item, calendar, this.noTitle);
        if (event) events.push(event);
      }
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
    return events;
  }

  async insertEvent(calendar: Calendar, event: NewEvent): Promise<CalEvent> {
    const created = await this.request<ApiEvent>(`/calendars/${encodeURIComponent(calendar.id)}/events`, {
      method: 'POST',
      body: newEventBody(event, this.timeZone),
    });
    const mapped = mapEvent(created, calendar, this.noTitle);
    if (!mapped) throw new CalendarError('server', null, 'unreadable');
    return mapped;
  }

  async reply(event: CalEvent, calendar: Calendar, response: Reply): Promise<CalEvent> {
    const updated = await this.request<ApiEvent>(
      `/calendars/${encodeURIComponent(calendar.id)}/events/${encodeURIComponent(event.id)}`,
      {method: 'PATCH', query: {sendUpdates: 'all'}, body: {attendees: attendeesWithReply(event.attendees, response)}},
    );
    const mapped = mapEvent(updated, calendar, this.noTitle);
    if (!mapped) throw new CalendarError('server', null, 'unreadable');
    return mapped;
  }
}
