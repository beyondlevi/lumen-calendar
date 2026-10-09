import {describe, expect, it} from 'vitest';
import {initialsOf, mapCalendar, mapCalendars, mapEvent, mapGuests, newEventBody, overlapsDay, stripHtml} from '../../src/google/mapping';
import type {Calendar} from '../../src/google/types';

const WORK: Calendar = {id: 'work', name: 'Work', color: '#2694fe', primary: false, writable: true, selected: true};

describe('calendars', () => {
  it('uses the name the owner gave, the color and the access role', () => {
    expect(mapCalendar({id: 'a@b', summary: 'a@b', summaryOverride: 'Personal', backgroundColor: '#26A756', accessRole: 'owner', primary: true, selected: true})).toEqual({
      id: 'a@b',
      name: 'Personal',
      color: '#26a756',
      primary: true,
      writable: true,
      selected: true,
    });
    expect(mapCalendar({id: 'h', summary: 'Holidays', accessRole: 'reader'})).toMatchObject({writable: false, selected: false, color: '#2694fe'});
  });

  it('puts the primary calendar first and drops deleted ones', () => {
    const list = mapCalendars([
      {id: 'w', summary: 'Work', accessRole: 'writer'},
      {id: 'gone', summary: 'Old', deleted: true},
      {id: 'p', summary: 'Me', primary: true, accessRole: 'owner'},
    ]);
    expect(list.map(calendar => calendar.id)).toEqual(['p', 'w']);
  });
});

describe('events', () => {
  it('maps a timed event with a Meet call, a place, guests and an HTML description', () => {
    const event = mapEvent(
      {
        id: 'e1',
        summary: 'Design review',
        location: 'Room 3',
        description: '<p>Go through the <b>new</b> screens&nbsp;before Friday&#39;s release.</p><ul><li>Prototype</li></ul>',
        start: {dateTime: '2026-10-09T18:00:00Z'},
        end: {dateTime: '2026-10-09T19:00:00Z'},
        hangoutLink: 'https://meet.google.com/abc-defg-hij',
        conferenceData: {conferenceSolution: {name: 'Google Meet'}, entryPoints: [{entryPointType: 'video', uri: 'https://meet.google.com/abc-defg-hij'}]},
        attendees: [
          {email: 'me@x', self: true, responseStatus: 'accepted'},
          {email: 'a@x', responseStatus: 'accepted'},
          {email: 'b@x', responseStatus: 'tentative'},
          {email: 'c@x', responseStatus: 'declined'},
          {email: 'd@x'},
          {email: 'room@resource', resource: true, responseStatus: 'accepted'},
        ],
      },
      WORK,
      '(No title)',
    );
    expect(event).toMatchObject({
      id: 'e1',
      calendarId: 'work',
      calendarName: 'Work',
      color: '#2694fe',
      title: 'Design review',
      allDay: false,
      start: new Date('2026-10-09T18:00:00Z'),
      end: new Date('2026-10-09T19:00:00Z'),
      location: 'Room 3',
      meeting: {kind: 'Google Meet', address: 'meet.google.com/abc-defg-hij'},
      guests: {total: 5, accepted: 2, tentative: 1, declined: 1, needsAction: 1, omitted: false},
      selfResponse: 'accepted',
      description: "Go through the new screens before Friday's release.\n\n• Prototype",
    });
  });

  it('maps an all-day event to local days, end exclusive', () => {
    const event = mapEvent({id: 'e2', summary: 'Trip', start: {date: '2026-10-11'}, end: {date: '2026-10-13'}}, WORK, '(No title)');
    expect(event).toMatchObject({allDay: true, start: new Date(2026, 9, 11), end: new Date(2026, 9, 13), guests: null, selfResponse: null, meeting: null});
    expect(overlapsDay(event!, new Date(2026, 9, 12))).toBe(true);
    expect(overlapsDay(event!, new Date(2026, 9, 13))).toBe(false);
  });

  it('names an untitled event and skips a cancelled one', () => {
    expect(mapEvent({id: 'e3', start: {dateTime: '2026-10-09T18:00:00Z'}}, WORK, '(No title)')).toMatchObject({
      title: '(No title)',
      end: new Date('2026-10-09T19:00:00Z'),
    });
    expect(mapEvent({id: 'e4', status: 'cancelled'}, WORK, '(No title)')).toBeNull();
  });

  it('builds the insert body for timed and all-day events', () => {
    expect(newEventBody({title: 'Trip', location: 'Ubatuba', start: new Date(2026, 9, 10), end: new Date(2026, 9, 12), allDay: true}, 'America/Sao_Paulo')).toEqual({
      summary: 'Trip',
      location: 'Ubatuba',
      start: {date: '2026-10-10'},
      end: {date: '2026-10-12'},
    });
  });
});

describe('stripHtml', () => {
  it('keeps text and line breaks, decodes entities', () => {
    expect(stripHtml('Line one<br>Line &amp; two<div>Three &#x2014; four</div>')).toBe('Line one\nLine & two\nThree — four');
    expect(stripHtml('plain text')).toBe('plain text');
  });

  it('keeps paragraphs apart, lists as bullets and the empty lines of Calendar\'s editor', () => {
    expect(stripHtml('<p>First.</p><p><b>Second</b> one.</p><ul><li>One</li><li>Two</li></ul>After')).toBe('First.\n\nSecond one.\n\n• One\n• Two\nAfter');
    expect(stripHtml('<div>a<br></div><div><br></div><div>b</div>')).toBe('a\n\nb');
    expect(stripHtml('a<br><br>b')).toBe('a\n\nb');
  });

  it('turns links into text, with the address when the words differ', () => {
    expect(
      stripHtml(
        'Doc: <a href="https://www.google.com/url?q=https://example.com/doc&amp;sa=D">the doc</a>, call <a href="https://meet.google.com/abc">https://meet.google.com/abc</a>, mail <a href="mailto:x@y.com">x@y.com</a>',
      ),
    ).toBe('Doc: the doc (https://example.com/doc), call https://meet.google.com/abc, mail x@y.com');
  });

  it('leaves plain text as it is, line breaks and all', () => {
    expect(stripHtml('Plain text\r\nsecond line\n\n\n\nafter, a < b and c > d')).toBe('Plain text\nsecond line\n\nafter, a < b and c > d');
  });

  it('never cuts a long description', () => {
    const paragraph = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20).trim();
    const html = Array.from({length: 12}, (_, index) => `<p>${index + 1}. ${paragraph}</p>`).join('');
    const text = stripHtml(html);
    expect(text.split('\n\n')).toHaveLength(12);
    expect(text.endsWith(`12. ${paragraph}`)).toBe(true);
    expect(text.length).toBeGreaterThan(12 * paragraph.length);
  });
});

describe('guests', () => {
  const attendees = [
    {email: 'lena@example.com', displayName: 'Lena', responseStatus: 'needsAction' as const},
    {email: 'bruno.lima@example.com', responseStatus: 'declined' as const},
    {email: 'julia@example.com', displayName: 'Julia Reis', responseStatus: 'accepted' as const},
    {email: 'room3@resource.calendar.google.com', displayName: 'Room 3', resource: true, responseStatus: 'accepted' as const},
    {email: 'rafael@example.com', displayName: 'Rafael Costa', responseStatus: 'tentative' as const},
    {email: 'me@example.com', self: true, responseStatus: 'accepted' as const},
    {email: 'marco@example.com', displayName: 'Marco Lopes', organizer: true, responseStatus: 'accepted' as const},
    {email: 'zoe@example.com', displayName: 'Zoe', responseStatus: 'something-new' as unknown as 'needsAction'},
  ];

  it('lists the people, organizer first, then the owner, then by answer and name; rooms left out', () => {
    const guests = mapGuests(attendees, true);
    expect(guests).toMatchObject({total: 7, accepted: 3, tentative: 1, declined: 1, needsAction: 2, omitted: true});
    expect(guests!.people.map(guest => [guest.name, guest.response, guest.organizer, guest.self, guest.initials])).toEqual([
      ['Marco Lopes', 'accepted', true, false, 'ML'],
      ['me@example.com', 'accepted', false, true, 'M'],
      ['Julia Reis', 'accepted', false, false, 'JR'],
      ['Rafael Costa', 'tentative', false, false, 'RC'],
      ['Lena', 'needsAction', false, false, 'L'],
      ['Zoe', 'needsAction', false, false, 'Z'],
      ['bruno.lima@example.com', 'declined', false, false, 'BL'],
    ]);
    expect(mapGuests([{email: 'room@resource', resource: true}])).toBeNull();
  });

  it('makes initials from a name or an address', () => {
    expect(initialsOf('Ana Maria Souza')).toBe('AS');
    expect(initialsOf('élodie')).toBe('É');
    expect(initialsOf('bruno.lima@example.com')).toBe('BL');
  });
});
