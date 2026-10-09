import {Page} from '@wearables-ui-toolkit/mrbd';
import {LoadingContent} from '../components/StateContent';
import {t} from '../i18n/strings';

/** While the settings are read from the phone. */
export function LoadingPage() {
  return (
    <Page headerText={t('loadingHeader')} headerIsLoading enableSystemBarInset={false}>
      <LoadingContent />
    </Page>
  );
}
