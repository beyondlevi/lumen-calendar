import {ListItem, VerticalList} from '@wearables-ui-toolkit/mrbd';
import {ErrorContent, LoadingContent, StateContent} from '../components/StateContent';
import type {Calendar} from '../google/types';
import {t} from '../i18n/strings';
import {useCalendar} from '../state/CalendarProvider';

function CalendarDot({calendar}: {calendar: Calendar}) {
  return <span className="calendar-dot" style={{backgroundColor: calendar.color}} />;
}

/** Every calendar of the account with its switch; the one new events go to says so. */
export function CalendarsTab() {
  const {calendars, status, retry, isShown, setShown, target} = useCalendar();

  if (status.kind === 'error') {
    return <ErrorContent error={status.error} onRetry={retry} />;
  }
  if (status.kind !== 'ready') {
    return <LoadingContent label={status.kind === 'connecting' ? t('connecting') : t('loadingLabel')} />;
  }
  if (calendars.length === 0) {
    return <StateContent title={t('emptyCalendarsTitle')} body={t('emptyCalendarsBody')} action={{label: t('retry'), onClick: retry}} ariaLabel={t('emptyLabel')} />;
  }

  return (
    <VerticalList insetForHeader ariaLabel={t('calendarsLabel')}>
      {calendars.map(calendar => {
        const dot = <CalendarDot calendar={calendar} />;
        const toggleShown = (checked: boolean) => setShown(calendar, checked);
        return (
          <ListItem
            key={calendar.id}
            title={calendar.name}
            subtitle={target?.id === calendar.id ? t('newEventsGoHere') : undefined}
            avatarPrimaryContent={dot}
            avatarAlt={calendar.name}
            showSwitch
            checked={isShown(calendar)}
            onCheckedChange={toggleShown}
          />
        );
      })}
    </VerticalList>
  );
}
