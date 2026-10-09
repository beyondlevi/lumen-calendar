import calendarBadgePlusFilled from '@wearables-ui-toolkit/icons/svg/calendarbadgeplus__filled.svg';
import clockFilled from '@wearables-ui-toolkit/icons/svg/clock__filled.svg';
import mapLocationPinFilled from '@wearables-ui-toolkit/icons/svg/maplocationpin__filled.svg';
import pencilFilled from '@wearables-ui-toolkit/icons/svg/pencil__filled.svg';
import trashFilled from '@wearables-ui-toolkit/icons/svg/trash__filled.svg';
import {Button, ButtonGroup, type ButtonHandle, ButtonGroupAlignment, Container, IconImage, MaterialLibrary, Page, ScrollView, TextColor, TextStyle, TextView} from '@wearables-ui-toolkit/mrbd';
import {useEffect, useMemo, useRef, useState} from 'react';
import {Navigate, useNavigate} from 'react-router-dom';
import {locale, t} from '../i18n/strings';
import {parseEventText, type ParsedEvent} from '../parse/eventText';
import {useCalendar} from '../state/CalendarProvider';
import {focusAfterTransition, requestFocus} from '../state/returnFocus';
import {addDays, now, sameDay, startOfDay} from '../time/clock';
import {dayWithDate, formatTimeRange} from '../time/format';

const TODAY_TAB = 0;

function whenText(parsed: ParsedEvent, today: Date): string | null {
  if (!parsed.start || !parsed.end) return null;
  if (parsed.allDay) {
    const lastDay = addDays(parsed.end, -1);
    const days = sameDay(parsed.start, lastDay)
      ? dayWithDate(parsed.start, today)
      : t('timeRange', {start: dayWithDate(parsed.start, today), end: dayWithDate(lastDay, today)});
    return t('pair', {first: days, second: t('allDay')});
  }
  return t('pair', {first: dayWithDate(parsed.start, today), second: formatTimeRange(parsed.start, parsed.end)});
}

/** What was understood from the text, to save in a calendar, edit or discard. */
export function ReviewPage() {
  const {draft, setDraft, setTab, target, writable, setTarget, save} = useCalendar();
  const navigate = useNavigate();
  const [parsed] = useState(() => parseEventText(draft, locale, now()));
  const [today] = useState(() => startOfDay(now()));
  const saveMaterial = useMemo(() => MaterialLibrary.themedPrimaryBlue(), []);
  const saving = useRef(false);
  const saveRef = useRef<ButtonHandle>(null);
  const editRef = useRef<ButtonHandle>(null);
  const canSave = parsed.start != null && parsed.end != null && target != null;

  // A new review starts on Save (or Edit when there is nothing to save), not
  // where the previous visit to this screen left the focus.
  useEffect(
    () => focusAfterTransition(() => (canSave ? saveRef : editRef).current?.getElement() ?? null),
    // Only when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (draft.trim() === '') {
    return <Navigate to="/" replace />;
  }

  const when = whenText(parsed, today);
  const title = parsed.title || t('noTitle');
  const canSwitch = writable.length > 1;

  const nextCalendar = () => {
    if (!target || !canSwitch) return;
    const index = writable.findIndex(calendar => calendar.id === target.id);
    setTarget(writable[(index + 1) % writable.length]);
  };

  const saveEvent = async () => {
    if (saving.current || !parsed.start || !parsed.end) return;
    saving.current = true;
    try {
      const saved = await save({title, location: parsed.location, start: parsed.start, end: parsed.end, allDay: parsed.allDay});
      if (saved) {
        requestFocus('next-event');
        setDraft('');
        setTab(TODAY_TAB);
        navigate(-1);
      }
    } finally {
      saving.current = false;
    }
  };
  const saveClicked = () => void saveEvent();

  const editText = () => {
    requestFocus('field');
    navigate(-1);
  };

  const discard = () => {
    requestFocus('next-event');
    setDraft('');
    setTab(TODAY_TAB);
    navigate(-1);
  };

  const cardLabel = t('reviewCardLabel', {title, when: when ?? t('noDateTitle'), calendar: target?.name ?? ''});

  return (
    <Page headerText={t('reviewHeader')} headerMetadata={t('reviewMetadata')} enableSystemBarInset={false}>
      <div className="action-page-shell">
        <ScrollView insetForHeader ariaLabel={t('reviewLabel')}>
          <div className="content-inset">
            <Container width="100%" onClick={nextCalendar} interactive={canSwitch} initialFocusEligible={false} aria-label={cardLabel}>
              <div className="review-card" aria-hidden="true">
                <TextView as="p" textStyle={TextStyle.BODY2_EMPHASIZED}>
                  {title}
                </TextView>
                <div className="fact-row">
                  <IconImage source={clockFilled} className="fact-icon" />
                  <TextView textStyle={TextStyle.BODY2} textColor={when ? TextColor.PRIMARY : TextColor.SECONDARY}>
                    {when ?? t('noDateTitle')}
                  </TextView>
                </div>
                {parsed.location ? (
                  <div className="fact-row">
                    <IconImage source={mapLocationPinFilled} className="fact-icon" />
                    <TextView textStyle={TextStyle.BODY2}>{parsed.location}</TextView>
                  </div>
                ) : null}
                {target ? (
                  <div className="fact-row">
                    <span className="calendar-dot" style={{backgroundColor: target.color}} />
                    <TextView textStyle={TextStyle.BODY2}>{target.name}</TextView>
                  </div>
                ) : null}
              </div>
            </Container>
            {!when ? (
              <TextView as="p" textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY} className="review-note">
                {t('noDateBody')}
              </TextView>
            ) : parsed.defaultDuration ? (
              <TextView as="p" textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY} className="review-note">
                {t('defaultDuration')}
              </TextView>
            ) : null}
          </div>
        </ScrollView>
        <div className="action-dock">
          <ButtonGroup alignment={ButtonGroupAlignment.CENTER}>
            <Button ref={saveRef} title={t('save')} icon={calendarBadgePlusFilled} alwaysShowText material={saveMaterial} disabled={!canSave} onClick={saveClicked} />
            <Button ref={editRef} title={t('edit')} icon={pencilFilled} onClick={editText} />
            <Button title={t('discard')} icon={trashFilled} onClick={discard} />
          </ButtonGroup>
        </div>
      </div>
    </Page>
  );
}
