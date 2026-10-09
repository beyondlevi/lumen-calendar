import type {Guest, Guests, ResponseStatus} from './google/types';
import {formatTag, t, tp, type StringKey} from './i18n/strings';

const RESPONSE: Record<ResponseStatus, StringKey> = {
  accepted: 'guestGoing',
  tentative: 'guestMaybe',
  declined: 'guestDeclined',
  needsAction: 'guestAwaiting',
};

/** "5 guests · 3 going, 1 maybe". */
export function guestsSummary(guests: Guests, tag: string = formatTag()): string {
  const answers = [
    guests.accepted > 0 ? t('guestsGoing', {count: guests.accepted}) : null,
    guests.tentative > 0 ? t('guestsMaybe', {count: guests.tentative}) : null,
    guests.declined > 0 ? t('guestsDeclined', {count: guests.declined}) : null,
  ].filter((part): part is string => part != null);
  const total = tp('guests', guests.total);
  if (answers.length === 0) return total;
  return t('pair', {first: total, second: new Intl.ListFormat(tag, {type: 'unit', style: 'short'}).format(answers)});
}

/** "Going", "Maybe · Organizer". */
export function guestDetail(guest: Guest): string {
  const response = t(RESPONSE[guest.response]);
  return guest.organizer ? t('pair', {first: response, second: t('guestOrganizer')}) : response;
}

/** The name, with "(you)" for the owner. */
export function guestName(guest: Guest): string {
  return guest.self ? t('guestYou', {name: guest.name}) : guest.name;
}
