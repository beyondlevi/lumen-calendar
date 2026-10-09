import camcorderFilled from '@wearables-ui-toolkit/icons/svg/camcorder__filled.svg';
import circleCheckFilled from '@wearables-ui-toolkit/icons/svg/circlecheck__filled.svg';
import mapLocationPinFilled from '@wearables-ui-toolkit/icons/svg/maplocationpin__filled.svg';
import users2Filled from '@wearables-ui-toolkit/icons/svg/users2__filled.svg';
import {Button, ButtonGroup, ButtonGroupAlignment, Container, IconImage, MaterialLibrary, Page, ScrollView, TextColor, TextStyle, TextView} from '@wearables-ui-toolkit/mrbd';
import {useMemo, useRef} from 'react';
import {useParams} from 'react-router-dom';
import {GUESTS_HEADING_ID, GuestList} from '../components/GuestList';
import {LoadingContent, StateContent} from '../components/StateContent';
import type {Reply} from '../google/client';
import type {CalEvent} from '../google/types';
import {guestsSummary} from '../guests';
import {t} from '../i18n/strings';
import {useCalendar} from '../state/CalendarProvider';
import {useDetailScroll} from '../state/useDetailScroll';
import {addDays, sameDay} from '../time/clock';
import {dayWithDate, formatTimeRange, relativeDay, startsIn} from '../time/format';

const GUESTS_SUMMARY_ID = 'event-guests-summary';

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

/**
 * One event: when, how to join, where, who, the whole description and the
 * guests; Going / Maybe / No when the owner is a guest. Down scrolls the
 * details to their end before it reaches the answers.
 */
export function EventPage() {
  const {calendarId = '', eventId = ''} = useParams();
  const {findEvent, status, today, current, reply} = useCalendar();
  const event = findEvent(calendarId, eventId);
  const goingMaterial = useMemo(() => MaterialLibrary.themedPrimaryBlue(), []);
  const maybeMaterial = useMemo(() => MaterialLibrary.themedPrimaryBlue(), []);
  const noMaterial = useMemo(() => MaterialLibrary.themedPrimaryBlue(), []);
  const sending = useRef(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const jumpTo = useDetailScroll(contentRef, shellRef, event?.guests ? GUESTS_SUMMARY_ID : null);

  if (!event) {
    const loading = status.kind === 'loading' || status.kind === 'connecting';
    return (
      <Page headerText={loading ? t('loadingHeader') : t('eventMissingTitle')} headerIsLoading={loading} enableSystemBarInset={false}>
        {loading ? <LoadingContent /> : <StateContent title={t('eventMissingTitle')} body={t('eventMissingBody')} role="alert" ariaLabel={t('eventMissingTitle')} />}
      </Page>
    );
  }

  const guest = event.selfResponse != null;
  const summary = event.guests ? guestsSummary(event.guests) : '';
  const showGuests = () => jumpTo(document.getElementById(GUESTS_HEADING_ID));
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
      <div className="action-page-shell" ref={shellRef}>
        <ScrollView insetForHeader tabIndex={0} ariaLabel={t('eventDetailsLabel')}>
          <div className="content-inset" ref={contentRef}>
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
              <Container width="100%" id={GUESTS_SUMMARY_ID} onClick={showGuests} initialFocusEligible={false} aria-label={t('guestsSummaryLabel', {summary})}>
                <div className="guests-summary" aria-hidden="true">
                  <IconImage source={users2Filled} className="fact-icon" />
                  <TextView textStyle={TextStyle.BODY2}>{summary}</TextView>
                </div>
              </Container>
            ) : null}
            {event.description ? (
              <TextView as="p" textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY} className="event-description" aria-label={t('descriptionLabel')}>
                {event.description}
              </TextView>
            ) : null}
            {event.guests ? <GuestList guests={event.guests} /> : null}
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
