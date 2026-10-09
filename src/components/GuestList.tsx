import {Avatar, AvatarSize, TextColor, TextStyle, TextView} from '@wearables-ui-toolkit/mrbd';
import type {Guests} from '../google/types';
import {guestDetail, guestName} from '../guests';
import {t} from '../i18n/strings';

export const GUESTS_HEADING_ID = 'event-guests';

/**
 * Who is invited and what each one answered. The guests are facts to read, not
 * commands, so they scroll with the rest of the event instead of taking focus.
 */
export function GuestList({guests}: {guests: Guests}) {
  return (
    <section className="guest-section" aria-labelledby={GUESTS_HEADING_ID}>
      <TextView as="h2" id={GUESTS_HEADING_ID} textStyle={TextStyle.LABEL_EMPHASIZED} textColor={TextColor.SECONDARY}>
        {t('guestsHeading', {count: guests.total})}
      </TextView>
      <ul className="guest-list">
        {guests.people.map((guest, index) => (
          <li key={`${guest.email ?? guest.name}-${index}`} className="guest-row">
            <Avatar size={AvatarSize.SMALL} primaryContent={guest.initials} alt={guest.name} />
            <div className="guest-text">
              <TextView textStyle={TextStyle.BODY2}>{guestName(guest)}</TextView>
              <TextView textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY}>
                {guestDetail(guest)}
              </TextView>
            </div>
          </li>
        ))}
      </ul>
      {guests.omitted ? (
        <TextView as="p" textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY}>
          {t('guestsOmitted')}
        </TextView>
      ) : null}
    </section>
  );
}
