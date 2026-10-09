import {describe, expect, it} from 'vitest';
import {GoogleCalendarClient} from '../../src/google/client';
import {TokenSource} from '../../src/google/oauth';
import type {CalEvent, Calendar} from '../../src/google/types';

const API = 'https://api.test/calendar/v3';
const TOKEN_URL = 'https://api.test/token';
const WORK: Calendar = {id: 'work@group.calendar.google.com', name: 'Work', color: '#2694fe', primary: false, writable: true, selected: true};

type Call = {url: URL; method: string; headers: Record<string, string>; body: unknown};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
}

/** A fake Google: tokens t1, t2…; `api` answers the Calendar calls. */
function setup(api: (call: Call, token: string) => Response) {
  const calls: Call[] = [];
  let issued = 0;
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.toString() === TOKEN_URL) {
      issued += 1;
      return json({access_token: `t${issued}`, expires_in: 3600});
    }
    const headers = {...(init?.headers as Record<string, string>)};
    const call = {url, method: init?.method ?? 'GET', headers, body: init?.body ? JSON.parse(String(init.body)) : undefined};
    calls.push(call);
    return api(call, headers.Authorization?.replace('Bearer ', '') ?? '');
  };
  const tokens = new TokenSource({clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh'}, TOKEN_URL, fetchImpl);
  const client = new GoogleCalendarClient(tokens, 'America/Sao_Paulo', '(No title)', API, fetchImpl);
  return {client, calls, issued: () => issued};
}

describe('GoogleCalendarClient', () => {
  it('sends only Authorization on reads, and Content-Type with a body', async () => {
    const {client, calls} = setup(call =>
      call.method === 'GET'
        ? json({items: [{id: 'p', summary: 'me@example.com', summaryOverride: 'Personal', primary: true, accessRole: 'owner', selected: true}]})
        : json({id: 'new', summary: 'Lunch', start: {dateTime: '2026-10-10T16:00:00Z'}, end: {dateTime: '2026-10-10T17:00:00Z'}}),
    );
    const [personal] = await client.listCalendars();
    expect(personal).toMatchObject({id: 'p', name: 'Personal', primary: true, writable: true});
    await client.insertEvent(personal, {title: 'Lunch', location: null, start: new Date('2026-10-10T16:00:00Z'), end: new Date('2026-10-10T17:00:00Z'), allDay: false});
    expect(Object.keys(calls[0].headers)).toEqual(['Authorization']);
    expect(calls[0].headers.Authorization).toBe('Bearer t1');
    expect(Object.keys(calls[1].headers).sort()).toEqual(['Authorization', 'Content-Type']);
    expect(calls[1].headers['Content-Type']).toBe('application/json');
    expect(calls[1].body).toEqual({
      summary: 'Lunch',
      start: {dateTime: '2026-10-10T16:00:00.000Z', timeZone: 'America/Sao_Paulo'},
      end: {dateTime: '2026-10-10T17:00:00.000Z', timeZone: 'America/Sao_Paulo'},
    });
  });

  it('lists events of a range as single events ordered by start, in the device time zone', async () => {
    const {client, calls} = setup(() => json({items: [{id: 'e1', summary: 'Gym', start: {dateTime: '2026-10-09T22:00:00Z'}, end: {dateTime: '2026-10-09T23:00:00Z'}}, {id: 'gone', status: 'cancelled'}]}));
    const events = await client.listEvents(WORK, new Date('2026-10-09T03:00:00Z'), new Date('2026-10-17T03:00:00Z'));
    expect(events.map(event => event.id)).toEqual(['e1']);
    const {url} = calls[0];
    expect(url.pathname).toBe('/calendar/v3/calendars/work%40group.calendar.google.com/events');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      timeMin: '2026-10-09T03:00:00.000Z',
      timeMax: '2026-10-17T03:00:00.000Z',
      singleEvents: 'true',
      orderBy: 'startTime',
      timeZone: 'America/Sao_Paulo',
    });
  });

  it('follows nextPageToken', async () => {
    const {client, calls} = setup(call =>
      call.url.searchParams.get('pageToken') === 'p2'
        ? json({items: [{id: 'b', summary: 'B', accessRole: 'reader'}]})
        : json({items: [{id: 'a', summary: 'A', accessRole: 'owner'}], nextPageToken: 'p2'}),
    );
    expect((await client.listCalendars()).map(calendar => calendar.id)).toEqual(['a', 'b']);
    expect(calls).toHaveLength(2);
  });

  it('renews the token once on a 401 and repeats the call once', async () => {
    const {client, calls, issued} = setup((_call, token) => (token === 't1' ? json({}, 401) : json({items: []})));
    expect(await client.listCalendars()).toEqual([]);
    expect(issued()).toBe(2);
    expect(calls.map(call => call.headers.Authorization)).toEqual(['Bearer t1', 'Bearer t2']);
  });

  it('gives up after the repeated call is refused too', async () => {
    const {client, calls, issued} = setup(() => json({}, 401));
    await expect(client.listCalendars()).rejects.toMatchObject({kind: 'auth'});
    expect(issued()).toBe(2);
    expect(calls).toHaveLength(2);
  });

  it('maps Google errors', async () => {
    const rate = setup(() => json({error: {errors: [{reason: 'rateLimitExceeded'}]}}, 403));
    await expect(rate.client.listCalendars()).rejects.toMatchObject({kind: 'ratelimit'});
    await expect(setup(() => json({error: {errors: [{reason: 'forbidden'}]}}, 403)).client.listCalendars()).rejects.toMatchObject({kind: 'forbidden'});
    await expect(setup(() => json({}, 404)).client.listCalendars()).rejects.toMatchObject({kind: 'notfound'});
    await expect(setup(() => json({}, 500)).client.listCalendars()).rejects.toMatchObject({kind: 'server', status: 500});
  });

  it('replies by patching the attendee list with sendUpdates=all', async () => {
    const attendees = [
      {email: 'me@example.com', self: true, responseStatus: 'needsAction' as const},
      {email: 'boss@example.com', organizer: true, responseStatus: 'accepted' as const},
    ];
    const {client, calls} = setup(call =>
      json({id: 'e1', summary: 'Standup', start: {dateTime: '2026-10-10T12:00:00Z'}, end: {dateTime: '2026-10-10T12:15:00Z'}, attendees: (call.body as {attendees: unknown}).attendees}),
    );
    const event = {id: 'e1', calendarId: WORK.id, attendees} as unknown as CalEvent;
    const updated = await client.reply(event, WORK, 'tentative');
    expect(calls[0].method).toBe('PATCH');
    expect(calls[0].url.pathname).toBe('/calendar/v3/calendars/work%40group.calendar.google.com/events/e1');
    expect(calls[0].url.searchParams.get('sendUpdates')).toBe('all');
    expect(calls[0].body).toEqual({
      attendees: [
        {email: 'me@example.com', self: true, responseStatus: 'tentative'},
        {email: 'boss@example.com', organizer: true, responseStatus: 'accepted'},
      ],
    });
    expect(updated.selfResponse).toBe('tentative');
  });
});
