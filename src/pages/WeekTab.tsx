import {ScrollView, TextColor, TextStyle, TextView} from '@wearables-ui-toolkit/mrbd';
import {Fragment} from 'react';
import {EventRow} from '../components/EventRow';
import {ErrorContent, LoadingContent, StateContent} from '../components/StateContent';
import {overlapsDay} from '../google/mapping';
import {t} from '../i18n/strings';
import {useCalendar} from '../state/CalendarProvider';
import {addDays} from '../time/clock';
import {weekDayHeading} from '../time/format';

const NEW_TAB = 2;
const DAYS = 7;

/** The 7 days after today, grouped by day. An event spanning days shows on each. */
export function WeekTab() {
  const {events, status, today, retry, setTab} = useCalendar();

  if (status.kind === 'error') {
    return <ErrorContent error={status.error} onRetry={retry} />;
  }
  if (status.kind !== 'ready') {
    return <LoadingContent label={status.kind === 'connecting' ? t('connecting') : t('loadingLabel')} />;
  }

  const days = Array.from({length: DAYS}, (_, index) => addDays(today, index + 1))
    .map(day => ({day, events: events.filter(event => overlapsDay(event, day))}))
    .filter(entry => entry.events.length > 0);
  const openNew = () => setTab(NEW_TAB);

  if (days.length === 0) {
    return (
      <StateContent
        title={t('emptyWeekTitle')}
        body={t('emptyWeekBody')}
        action={{label: t('newEventAction'), onClick: openNew}}
        ariaLabel={t('emptyLabel')}
      />
    );
  }

  return (
    <ScrollView insetForHeader ariaLabel={t('weekLabel')}>
      <div className="agenda-inset">
        {days.map(({day, events: dayEvents}) => (
          <Fragment key={day.toISOString()}>
            <TextView as="h2" textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY} className="day-heading">
              {weekDayHeading(day, today)}
            </TextView>
            {dayEvents.map(event => (
              <EventRow key={`${day.toISOString()}/${event.calendarId}/${event.id}`} event={event} />
            ))}
          </Fragment>
        ))}
      </div>
    </ScrollView>
  );
}
