import sunFilled from '@wearables-ui-toolkit/icons/svg/sun__filled.svg';
import {Chip, ChipStyle, ScrollView} from '@wearables-ui-toolkit/mrbd';
import {useEffect} from 'react';
import {EventRow} from '../components/EventRow';
import {ErrorContent, LoadingContent, StateContent} from '../components/StateContent';
import {overlapsDay} from '../google/mapping';
import {t} from '../i18n/strings';
import {useCalendar} from '../state/CalendarProvider';
import {focusAfterTransition, takeFocus} from '../state/returnFocus';
import {startsIn} from '../time/format';

const NEW_TAB = 2;

/** Today: all-day events as chips, then the timed ones; the next one takes the focus. */
export function TodayTab() {
  const {events, status, today, current, retry, setTab} = useCalendar();

  useEffect(() => {
    if (!takeFocus('next-event')) return;
    return focusAfterTransition(() => document.querySelector<HTMLElement>('[data-next-event="true"]'));
  }, []);

  if (status.kind === 'error') {
    return <ErrorContent error={status.error} onRetry={retry} />;
  }
  if (status.kind !== 'ready') {
    return <LoadingContent label={status.kind === 'connecting' ? t('connecting') : t('loadingLabel')} />;
  }

  const todays = events.filter(event => overlapsDay(event, today));
  const allDay = todays.filter(event => event.allDay);
  const timed = todays.filter(event => !event.allDay);
  const nextIndex = timed.findIndex(event => event.end > current);
  const openNew = () => setTab(NEW_TAB);

  if (nextIndex < 0) {
    return (
      <StateContent
        title={timed.length > 0 ? t('emptyTodayRestTitle') : t('emptyTodayTitle')}
        body={allDay.length > 0 ? allDay.map(event => event.title).join(' · ') : t('emptyTodayBody')}
        action={{label: t('newEventAction'), onClick: openNew}}
        ariaLabel={t('emptyLabel')}
      />
    );
  }

  return (
    <ScrollView insetForHeader ariaLabel={t('todayLabel')}>
      <div className="agenda-inset">
        {allDay.length > 0 ? (
          <div className="all-day-chips">
            {allDay.map(event => (
              <Chip key={`${event.calendarId}/${event.id}`} text={t('allDay')} metadata={event.title} icon={sunFilled} chipStyle={ChipStyle.DEEMPHASIZED} />
            ))}
          </div>
        ) : null}
        {timed.map((event, index) => (
          <EventRow
            key={`${event.calendarId}/${event.id}`}
            event={event}
            past={index < nextIndex}
            relative={index === nextIndex ? startsIn(event.start, event.end, current) : null}
            initialFocus={index === nextIndex}
            next={index === nextIndex}
          />
        ))}
      </div>
    </ScrollView>
  );
}
