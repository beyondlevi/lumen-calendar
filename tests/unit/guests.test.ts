import {describe, expect, it} from 'vitest';
import {mapGuests} from '../../src/google/mapping';
import {guestDetail, guestName, guestsSummary} from '../../src/guests';
import {translate} from '../../src/i18n/strings';

describe('guest texts', () => {
  const guests = mapGuests([
    {email: 'marco@example.com', displayName: 'Marco', organizer: true, responseStatus: 'accepted'},
    {email: 'me@example.com', displayName: 'Ana', self: true, responseStatus: 'tentative'},
    {email: 'julia@example.com', displayName: 'Julia', responseStatus: 'declined'},
    {email: 'lena@example.com', displayName: 'Lena'},
  ])!;

  it('says each answer, the organizer and "you"', () => {
    expect(guests.people.map(guest => [guestName(guest), guestDetail(guest)])).toEqual([
      ['Marco', 'Going · Organizer'],
      ['Ana (you)', 'Maybe'],
      ['Lena', 'Awaiting'],
      ['Julia', 'Declined'],
    ]);
  });

  it('keeps the summary line', () => {
    expect(guestsSummary(guests, 'en-US')).toBe('4 guests · 1 going, 1 maybe, 1 declined');
  });

  it('has the guest words in Portuguese', () => {
    expect(['guestGoing', 'guestMaybe', 'guestDeclined', 'guestAwaiting', 'guestOrganizer'].map(key => translate('pt', key as 'guestGoing'))).toEqual([
      'Vai',
      'Talvez',
      'Recusou',
      'Sem resposta',
      'Organizador',
    ]);
    expect(translate('pt', 'guestYou', {name: 'Ana'})).toBe('Ana (você)');
    expect(translate('pt', 'guestsHeading', {count: 6})).toBe('Convidados (6)');
  });
});
