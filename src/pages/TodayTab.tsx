import sunFilled from '@wearables-ui-toolkit/icons/svg/sun__filled.svg';
import {Chip, ChipStyle, ScrollView} from '@wearables-ui-toolkit/mrbd';
import {useEffect} from 'react';
import {EventRow} from '../components/EventRow';
import {ErrorContent, LoadingContent, StateContent} from '../components/StateContent';
import {overlapsDay} from '../google/mapping';
import {t} from '../i18n/strings';
import {useCalendar} from '../state/CalendarProvider';
import {focusAfterTransition, takeFocus} from '../state/returnFocus';
import {focusEventIndex} from '../time/agenda';
import {now} from '../time/clock';
import {startsIn} from '../time/format';

const NEW_TAB = 2;

// The agenda opens on the event of now once per launch, unless the wearer has
// already moved (a key pressed while it loaded).
let launchFocusDone = false;
let keyPressedSinceLaunch = false;
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', () => (keyPressedSinceLaunch = true), {capture: true, once: true});
}

/** Focuses the event going on now (or the next one) and scrolls it to the middle of the agenda. */
function focusEventOfNow(): HTMLElement | null {
  const row = document.querySelector<HTMLElement>('[data-next-event="true"]');
  if (row) {
    if (document.activeElement !== row) row.focus({preventScroll: true});
    row.scrollIntoView({block: 'center', inline: 'nearest'});
  }
  return row;
}

/** True when the focus is nowhere, or on an event that is over. */
function focusOnPastOrNothing(current: Date): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === document.body) return true;
  const end = Number(active.dataset.eventEnd);
  return Number.isFinite(end) && end <= current.getTime();
}

/** Today: all-day events as chips, then the timed ones, opened on the event going on now or the next one. */
export function TodayTab({active}: {active: boolean}) {
  const {events, status, today, current, resumes, retry, setTab} = useCalendar();
  const ready = status.kind === 'ready';
  const timedToday = events.filter(event => !event.allDay && overlapsDay(event, today));
  const focusIndex = focusEventIndex(timedToday, current);
  const focusKey = focusIndex >= 0 ? `${timedToday[focusIndex].calendarId}/${timedToday[focusIndex].id}` : null;

  // Back from Review (saved or discarded): the event of now again.
  useEffect(() => {
    if (!takeFocus('next-event')) return;
    return focusAfterTransition(focusEventOfNow);
  }, []);

  // On launch, once the day has loaded.
  useEffect(() => {
    if (launchFocusDone || !ready || !active || focusKey == null) return;
    launchFocusDone = true;
    if (keyPressedSinceLaunch) return;
    return focusAfterTransition(focusEventOfNow);
  }, [active, focusKey, ready]);

  // Back in the app after a while: the focused event may be over.
  useEffect(() => {
    if (resumes === 0 || !ready || !active || focusKey == null || !focusOnPastOrNothing(now())) return;
    return focusAfterTransition(focusEventOfNow);
    // Only when the wearer comes back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumes]);

  if (status.kind === 'error') {
    return <ErrorContent error={status.error} onRetry={retry} />;
  }
  if (status.kind !== 'ready') {
    return <LoadingContent label={status.kind === 'connecting' ? t('connecting') : t('loadingLabel')} />;
  }

  const todays = events.filter(event => overlapsDay(event, today));
  const allDay = todays.filter(event => event.allDay);
  const timed = todays.filter(event => !event.allDay);
  const nextIndex = focusEventIndex(timed, current);
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
