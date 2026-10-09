import {Button, ScrollView, Shimmer, ShimmerItem, ShimmerItemCornerRadius, TextColor, TextStyle, TextView} from '@wearables-ui-toolkit/mrbd';
import type {CalendarError} from '../google/errors';
import {t} from '../i18n/strings';

/** Title and body for a failed request. */
export function errorCopy(error: CalendarError | null): [string, string] {
  switch (error?.kind) {
    case 'network':
      return [t('errNetworkTitle'), t('errNetworkBody')];
    case 'ratelimit':
      return [t('errRateTitle'), t('errRateBody')];
    case 'forbidden':
      return [t('errForbiddenTitle'), t('errForbiddenBody')];
    case 'notfound':
      return [t('errNotFoundTitle'), t('errNotFoundBody')];
    default:
      return [t('errServerTitle'), t('errServerBody')];
  }
}

type Props = {
  title: string;
  body: string;
  /** Recovery command; without one the text itself takes focus. */
  action?: {label: string; onClick(): void};
  detail?: string;
  role?: 'alert' | 'status';
  ariaLabel: string;
};

/** Empty and error states: copy in the page's single ScrollView, with its recovery Button below. */
export function StateContent({title, body, action, detail, role, ariaLabel}: Props) {
  return (
    <ScrollView insetForHeader tabIndex={action ? undefined : 0} ariaLabel={ariaLabel}>
      <div className="content-inset" role={role}>
        <TextView as="p" textStyle={TextStyle.BODY2_EMPHASIZED}>
          {title}
        </TextView>
        <TextView as="p" textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY}>
          {body}
        </TextView>
        {detail ? (
          <TextView as="p" textStyle={TextStyle.META2} textColor={TextColor.SECONDARY}>
            {detail}
          </TextView>
        ) : null}
        {action ? (
          <div className="state-action">
            <Button title={action.label} alwaysShowText onClick={action.onClick} />
          </div>
        ) : null}
      </div>
    </ScrollView>
  );
}

/** The error state of the agenda, with Try again. */
export function ErrorContent({error, onRetry}: {error: CalendarError | null; onRetry(): void}) {
  const [title, body] = errorCopy(error);
  return (
    <StateContent
      title={title}
      body={body}
      detail={error?.status != null ? t('httpStatus', {status: error.status}) : undefined}
      action={{label: t('retry'), onClick: onRetry}}
      role="alert"
      ariaLabel={t('errorLabel')}
    />
  );
}

/** While the agenda loads: placeholders shaped like its rows. */
export function LoadingContent({rows = 3, label = t('loadingLabel')}: {rows?: number; label?: string}) {
  return (
    <ScrollView insetForHeader ariaLabel={label}>
      <div className="content-inset" role="status" aria-label={label}>
        <Shimmer>
          <div className="shimmer-rows">
            {Array.from({length: rows}, (_, index) => (
              <div key={index} className="shimmer-row">
                <ShimmerItem className="shimmer-time" cornerRadius={ShimmerItemCornerRadius.XLARGE} />
                <div className="shimmer-lines">
                  <ShimmerItem className="shimmer-line shimmer-line--short" />
                  <ShimmerItem className="shimmer-line" />
                </div>
              </div>
            ))}
          </div>
        </Shimmer>
      </div>
    </ScrollView>
  );
}
