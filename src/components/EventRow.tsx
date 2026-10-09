import sunFilled from '@wearables-ui-toolkit/icons/svg/sun__filled.svg';
import {Container, IconImage, TextColor, TextStyle, TextView} from '@wearables-ui-toolkit/mrbd';
import {useNavigate} from 'react-router-dom';
import type {CalEvent} from '../google/types';
import {t} from '../i18n/strings';
import {eventPath} from '../paths';
import {formatTime, formatTimeRange} from '../time/format';

type Props = {
  event: CalEvent;
  /** Over: shown dimmed. */
  past?: boolean;
  /** "in 25 min" or "now", in the accent color. */
  relative?: string | null;
  /** The row that takes the focus when the page opens. */
  initialFocus?: boolean;
  /** Today's next event: where the focus returns after a new event is saved. */
  next?: boolean;
};

/** "Google Meet · Work", "Coco Bambu · Personal", "All day · Personal". */
export function eventDetail(event: CalEvent): string {
  const detail = event.allDay ? t('allDay') : (event.meeting?.kind ?? event.location);
  return detail ? t('pair', {first: detail, second: event.calendarName}) : event.calendarName;
}

/** One event of the agenda: the times (or the sun for all day), the calendar's dot, title and detail. */
export function EventRow({event, past = false, relative = null, initialFocus = true, next = false}: Props) {
  const navigate = useNavigate();
  const textColor = past ? TextColor.SECONDARY : TextColor.PRIMARY;
  const time = event.allDay ? t('allDay') : formatTimeRange(event.start, event.end);
  const label = relative
    ? t('eventLabelNext', {title: event.title, time, calendar: eventDetail(event), relative})
    : t('eventLabel', {title: event.title, time, calendar: eventDetail(event)});

  const openEvent = () => navigate(eventPath(event));

  return (
    <Container width="100%" onClick={openEvent} initialFocusEligible={initialFocus} aria-label={label} data-next-event={next ? 'true' : undefined} data-event-end={event.end.getTime()}>
      <div className="event-row" aria-hidden="true">
        {event.allDay ? (
          <IconImage source={sunFilled} className="event-row-icon" />
        ) : (
          <div className="event-row-time">
            <TextView textStyle={TextStyle.BODY2} textColor={textColor}>
              {formatTime(event.start)}
            </TextView>
            <TextView textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY}>
              {formatTime(event.end)}
            </TextView>
          </div>
        )}
        <div className="event-row-main">
          <div className="event-row-heading">
            <span className="calendar-dot" style={{backgroundColor: event.color}} />
            <TextView textStyle={TextStyle.BODY2} textColor={textColor} className="event-row-title">
              {event.title}
            </TextView>
            {relative ? (
              <TextView textStyle={TextStyle.LABEL} textColor={TextColor.ACCENT} className="event-row-when">
                {relative}
              </TextView>
            ) : null}
          </div>
          <TextView textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY} className="event-row-detail">
            {eventDetail(event)}
          </TextView>
        </div>
      </div>
    </Container>
  );
}
