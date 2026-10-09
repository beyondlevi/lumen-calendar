import camcorderFilled from '@wearables-ui-toolkit/icons/svg/camcorder__filled.svg';
import circleCheckFilled from '@wearables-ui-toolkit/icons/svg/circlecheck__filled.svg';
import mapLocationPinFilled from '@wearables-ui-toolkit/icons/svg/maplocationpin__filled.svg';
import users2Filled from '@wearables-ui-toolkit/icons/svg/users2__filled.svg';
import {Button, ButtonGroup, ButtonGroupAlignment, IconImage, MaterialLibrary, Page, ScrollView, TextColor, TextStyle, TextView} from '@wearables-ui-toolkit/mrbd';
import {useMemo, useRef} from 'react';
import {useParams} from 'react-router-dom';
import {LoadingContent, StateContent} from '../components/StateContent';
import type {Reply} from '../google/client';
import type {CalEvent, Guests} from '../google/types';
import {formatTag, t, tp} from '../i18n/strings';
import {useCalendar} from '../state/CalendarProvider';
import {addDays, sameDay} from '../time/clock';
import {dayWithDate, formatTimeRange, relativeDay, startsIn} from '../time/format';

/** Long descriptions are cut here; the full text stays in Google Calendar. */
const DESCRIPTION_LIMIT = 360;
const GUEST_DESCRIPTION_LIMIT = 140;

function guestsSummary(guests: Guests): string {
  const answers = [
    guests.accepted > 0 ? t('guestsGoing', {count: guests.accepted}) : null,
    guests.tentative > 0 ? t('guestsMaybe', {count: guests.tentative}) : null,
    guests.declined > 0 ? t('guestsDeclined', {count: guests.declined}) : null,
  ].filter((part): part is string => part != null);
  const total = tp('guests', guests.total);
  if (answers.length === 0) return total;
  return t('pair', {first: total, second: new Intl.ListFormat(formatTag(), {type: 'unit', style: 'short'}).format(answers)});
}

function clamp(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(' ');
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function whenText(event: CalEvent, today: Date): string {
  if (!event.allDay) return formatTimeRange(event.start, event.end);
  const lastDay = addDays(event.end, -1);
  return sameDay(event.start, lastDay)
    ? t('allDay')
    : t('timeRange', {start: dayWithDate(event.start, today), end: dayWithDate(lastDay, today)});
}

function dayText(event: CalEvent, today: Date, current: Date): string {
  const day = relativeDay(event.start, today);
  const soon = event.allDay ? null : startsIn(event.start, event.end, current);
  return soon ? t('pair', {first: day, second: soon}) : day;
}

/** One event: when, how to join, where, who, what; Going / Maybe / No when the owner is a guest. */
export function EventPage() {
  const {calendarId = '', eventId = ''} = useParams();
  const {findEvent, status, today, current, reply} = useCalendar();
  const event = findEvent(calendarId, eventId);
  const goingMaterial = useMemo(() => MaterialLibrary.themedPrimaryBlue(), []);
  const maybeMaterial = useMemo(() => MaterialLibrary.themedPrimaryBlue(), []);
  const noMaterial = useMemo(() => MaterialLibrary.themedPrimaryBlue(), []);
  const sending = useRef(false);

  if (!event) {
    const loading = status.kind === 'loading' || status.kind === 'connecting';
    return (
      <Page headerText={loading ? t('loadingHeader') : t('eventMissingTitle')} headerIsLoading={loading} enableSystemBarInset={false}>
        {loading ? <LoadingContent /> : <StateContent title={t('eventMissingTitle')} body={t('eventMissingBody')} role="alert" ariaLabel={t('eventMissingTitle')} />}
      </Page>
    );
  }

  const guest = event.selfResponse != null;
  const answer = event.selfResponse;
  const send = async (response: Reply) => {
    if (sending.current || answer === response) return;
    sending.current = true;
    try {
      await reply(event, response);
    } finally {
      sending.current = false;
    }
  };
  const replyGoing = () => void send('accepted');
  const replyMaybe = () => void send('tentative');
  const replyNo = () => void send('declined');
  const soon = !event.allDay && startsIn(event.start, event.end, current) != null && sameDay(event.start, current);

  return (
    <Page headerText={event.title} headerMaxLines={1} headerMetadata={event.calendarName} enableSystemBarInset={false}>
      <div className="action-page-shell">
        <ScrollView insetForHeader tabIndex={0} ariaLabel={t('eventDetailsLabel')}>
          <div className="content-inset">
            <div className="event-when">
              <TextView as="p" textStyle={TextStyle.BODY2_EMPHASIZED}>
                {whenText(event, today)}
              </TextView>
              <TextView as="p" textStyle={TextStyle.LABEL} textColor={soon ? TextColor.ACCENT : TextColor.SECONDARY}>
                {dayText(event, today, current)}
              </TextView>
            </div>
            {event.meeting ? (
              <div className="fact-row">
                <IconImage source={camcorderFilled} className="fact-icon" />
                <TextView textStyle={TextStyle.BODY2}>{event.meeting.address ?? event.meeting.kind}</TextView>
              </div>
            ) : null}
            {event.location ? (
              <div className="fact-row">
                <IconImage source={mapLocationPinFilled} className="fact-icon" />
                <TextView textStyle={TextStyle.BODY2}>{event.location}</TextView>
              </div>
            ) : null}
            {event.guests ? (
              <div className="fact-row">
                <IconImage source={users2Filled} className="fact-icon" />
                <TextView textStyle={TextStyle.BODY2}>{guestsSummary(event.guests)}</TextView>
              </div>
            ) : null}
            {event.description ? (
              <TextView as="p" textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY} className="event-description">
                {clamp(event.description, guest ? GUEST_DESCRIPTION_LIMIT : DESCRIPTION_LIMIT)}
              </TextView>
            ) : null}
          </div>
        </ScrollView>
        {guest ? (
          <div className="action-dock">
            <ButtonGroup alignment={ButtonGroupAlignment.CENTER}>
              <Button
                title={t('replyGoing')}
                alwaysShowText
                icon={answer === 'accepted' ? circleCheckFilled : undefined}
                material={answer === 'accepted' ? goingMaterial : undefined}
                onClick={replyGoing}
              />
              <Button
                title={t('replyMaybe')}
                alwaysShowText
                icon={answer === 'tentative' ? circleCheckFilled : undefined}
                material={answer === 'tentative' ? maybeMaterial : undefined}
                onClick={replyMaybe}
              />
              <Button
                title={t('replyNo')}
                alwaysShowText
                icon={answer === 'declined' ? circleCheckFilled : undefined}
                material={answer === 'declined' ? noMaterial : undefined}
                onClick={replyNo}
              />
            </ButtonGroup>
          </div>
        ) : null}
      </div>
    </Page>
  );
}
