import calendarFilled from '@wearables-ui-toolkit/icons/svg/calendar__filled.svg';
import circle1Filled from '@wearables-ui-toolkit/icons/svg/circle1__filled.svg';
import circle2Filled from '@wearables-ui-toolkit/icons/svg/circle2__filled.svg';
import circle3Filled from '@wearables-ui-toolkit/icons/svg/circle3__filled.svg';
import rotateClockwiseFilled from '@wearables-ui-toolkit/icons/svg/rotateclockwise__filled.svg';
import {AppBadge, Button, ButtonGroup, ButtonGroupAlignment, IconImage, MaterialLibrary, Page, ScrollView, TextColor, TextStyle, TextView} from '@wearables-ui-toolkit/mrbd';
import {useMemo, useRef} from 'react';
import {t} from '../i18n/strings';
import {useCalendar} from '../state/CalendarProvider';

const STEPS = [
  {icon: circle1Filled, key: 'setupStep1'},
  {icon: circle2Filled, key: 'setupStep2'},
  {icon: circle3Filled, key: 'setupStep3'},
] as const;

/** Shown while the Google settings are incomplete or Google refuses the refresh token. */
export function SetupPage({reason}: {reason: 'missing' | 'refused'}) {
  const {reconnect} = useCalendar();
  const retryMaterial = useMemo(() => MaterialLibrary.themedPrimaryBlue(), []);
  const checking = useRef(false);

  const tryAgain = async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      await reconnect();
    } finally {
      checking.current = false;
    }
  };

  const retryConnection = () => void tryAgain();

  return (
    <Page showHeader={false} enableSystemBarInset={false}>
      <div className="action-page-shell">
        <ScrollView ariaLabel={t('setupLabel')}>
          <div className="setup-inset" role={reason === 'refused' ? 'alert' : 'status'}>
            <AppBadge icon={calendarFilled} />
            <TextView as="h1" textStyle={TextStyle.BODY2_EMPHASIZED}>
              {t('setupTitle')}
            </TextView>
            <ol className="setup-steps" aria-label={t('setupStepsLabel')}>
              {STEPS.map(step => (
                <li key={step.key} className="setup-step">
                  <IconImage source={step.icon} className="setup-step-number" />
                  <TextView textStyle={TextStyle.BODY2}>{t(step.key)}</TextView>
                </li>
              ))}
            </ol>
            <TextView as="p" textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY}>
              {reason === 'refused' ? t('setupRefused') : t('setupNote')}
            </TextView>
          </div>
        </ScrollView>
        <div className="action-dock">
          <ButtonGroup alignment={ButtonGroupAlignment.CENTER}>
            <Button title={t('retry')} icon={rotateClockwiseFilled} alwaysShowText material={retryMaterial} onClick={retryConnection} />
          </ButtonGroup>
        </div>
      </div>
    </Page>
  );
}
