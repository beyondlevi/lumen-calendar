import calendarFilled from '@wearables-ui-toolkit/icons/svg/calendar__filled.svg';
import calendarBadgePlusFilled from '@wearables-ui-toolkit/icons/svg/calendarbadgeplus__filled.svg';
import sliders2HorizontalFilled from '@wearables-ui-toolkit/icons/svg/sliders2horizontal__filled.svg';
import sunFilled from '@wearables-ui-toolkit/icons/svg/sun__filled.svg';
import {SubNavigationPager, type SubNavigationItem} from '@wearables-ui-toolkit/mrbd';
import {useMemo} from 'react';
import {t} from '../i18n/strings';
import {useCalendar} from '../state/CalendarProvider';
import {CalendarsTab} from './CalendarsTab';
import {TodayTab} from './TodayTab';
import {WeekTab} from './WeekTab';
import {WriteTab} from './WriteTab';

export const TODAY_TAB = 0;
export const NEW_TAB = 2;

/** The app's top level: Today, Week, New event and Calendars as peer tabs. */
export function HomePager() {
  const {tab, setTab, status} = useCalendar();
  const loading = status.kind === 'loading' || status.kind === 'connecting';
  const items = useMemo<SubNavigationItem[]>(
    () => [
      {label: t('tabToday'), icon: sunFilled, isLoading: loading},
      {label: t('tabWeek'), icon: calendarFilled, isLoading: loading},
      {label: t('tabNew'), icon: calendarBadgePlusFilled},
      {label: t('tabCalendars'), icon: sliders2HorizontalFilled, isLoading: loading},
    ],
    [loading],
  );

  return (
    <SubNavigationPager items={items} currentPageIndex={tab} onPageChange={next => setTab(next)} useBackButtonForHome homeIndex={TODAY_TAB}>
      <TodayTab active={tab === TODAY_TAB} />
      <WeekTab />
      <WriteTab active={tab === NEW_TAB} />
      <CalendarsTab />
    </SubNavigationPager>
  );
}
