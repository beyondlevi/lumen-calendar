export type CalendarErrorKind = 'network' | 'auth' | 'forbidden' | 'notfound' | 'ratelimit' | 'server';

/** A failed call to Google. `auth` means the refresh token was refused: the Setup screen. */
export class CalendarError extends Error {
  readonly kind: CalendarErrorKind;
  readonly status: number | null;

  constructor(kind: CalendarErrorKind, status: number | null = null, message: string = kind) {
    super(message);
    this.name = 'CalendarError';
    this.kind = kind;
    this.status = status;
  }
}

export function asCalendarError(error: unknown): CalendarError {
  if (error instanceof CalendarError) return error;
  if (error instanceof DOMException && error.name === 'AbortError') return new CalendarError('network', null, 'aborted');
  // fetch() rejects with a TypeError when the network is down or CORS fails.
  return new CalendarError('network');
}

type GoogleErrorBody = {error?: {errors?: {reason?: string}[]; status?: string} | string; error_description?: string};

/** Maps an API response that isn't ok. */
export async function errorFromResponse(response: Response): Promise<CalendarError> {
  let body: GoogleErrorBody = {};
  try {
    body = (await response.json()) as GoogleErrorBody;
  } catch {
    // Not JSON.
  }
  const reasons = typeof body.error === 'object' ? (body.error.errors ?? []).map(entry => entry.reason ?? '') : [];
  const status = response.status;
  if (status === 429 || (status === 403 && reasons.some(reason => /rateLimit/i.test(reason)))) {
    return new CalendarError('ratelimit', status);
  }
  if (status === 401) return new CalendarError('auth', status);
  if (status === 403) return new CalendarError('forbidden', status);
  if (status === 404 || status === 410) return new CalendarError('notfound', status);
  return new CalendarError('server', status);
}
