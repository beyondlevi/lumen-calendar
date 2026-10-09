import circleArrowRightFilled from '@wearables-ui-toolkit/icons/svg/circlearrowright__filled.svg';
import {ActionHint, Button, InputTextView, MaterialLibrary, ScrollView, TextColor, TextStyle, TextView} from '@wearables-ui-toolkit/mrbd';
import {useEffect, useMemo} from 'react';
import {useNavigate} from 'react-router-dom';
import {t} from '../i18n/strings';
import {REVIEW_PATH} from '../paths';
import {useCalendar} from '../state/CalendarProvider';
import {focusAfterTransition, takeFocus} from '../state/returnFocus';

export const EVENT_FIELD_ID = 'event-text';

/**
 * The event as one sentence, in a real text field: Enter on it opens Lumen's
 * composer, which dictates or takes handwriting from the band and fills the
 * field through `input` and `change` events.
 */
export function WriteTab({active}: {active: boolean}) {
  const {draft, setDraft} = useCalendar();
  const navigate = useNavigate();
  const continueMaterial = useMemo(() => MaterialLibrary.themedPrimaryBlue(), []);

  useEffect(() => {
    if (!active || !takeFocus('field')) return;
    return focusAfterTransition(() => document.getElementById(EVENT_FIELD_ID));
  }, [active]);

  const continueToReview = () => navigate(REVIEW_PATH);

  return (
    <ScrollView insetForHeader ariaLabel={t('writeLabel')}>
      <div className="write-inset">
        <InputTextView
          text={draft}
          hint={t('writeHint')}
          onTextChange={setDraft}
          inputProps={{id: EVENT_FIELD_ID, 'aria-label': t('writeFieldLabel'), maxLength: 300}}
        />
        <TextView as="p" textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY} className="write-example">
          {t('writeExample')}
        </TextView>
        <div className="write-action">
          <Button
            title={t('continue')}
            icon={circleArrowRightFilled}
            alwaysShowText
            material={continueMaterial}
            disabled={draft.trim() === ''}
            onClick={continueToReview}
          />
        </div>
        <div className="write-hints">
          <ActionHint text={t('hintIndexTap')} />
          <ActionHint text={t('hintMiddleTap')} />
        </div>
      </div>
    </ScrollView>
  );
}
