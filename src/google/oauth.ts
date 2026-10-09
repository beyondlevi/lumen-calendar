import {CalendarError} from './errors';

export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export type Credentials = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

type TokenResponse = {access_token?: string; expires_in?: number; error?: string};

/** Seconds before `expires_in` runs out when a token is no longer used. */
const EARLY_RENEWAL_MS = 60_000;

/**
 * Turns the refresh token into access tokens: keeps one in memory until about
 * a minute before it expires, and shares a single renewal between callers that
 * need one at the same time. Nothing is stored or logged.
 */
export class TokenSource {
  private token: {value: string; expiresAt: number} | null = null;
  private pending: Promise<string> | null = null;

  constructor(
    private readonly credentials: Credentials,
    private readonly tokenUrl: string = GOOGLE_TOKEN_URL,
    private readonly fetchImpl: typeof fetch = (input, init) => fetch(input, init),
    private readonly clock: () => number = () => Date.now(),
  ) {}

  /** A valid access token, renewed when needed. */
  get(): Promise<string> {
    if (this.token && this.clock() < this.token.expiresAt - EARLY_RENEWAL_MS) {
      return Promise.resolve(this.token.value);
    }
    return this.refresh();
  }

  /** Drops `stale` (Google answered 401 with it); a newer token is kept. */
  invalidate(stale: string): void {
    if (this.token?.value === stale) {
      this.token = null;
    }
  }

  /** Asks Google for a new access token; concurrent calls share one request. */
  refresh(): Promise<string> {
    if (this.pending) return this.pending;
    this.pending = this.request().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async request(): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.credentials.clientId,
      client_secret: this.credentials.clientSecret,
      refresh_token: this.credentials.refreshToken,
      grant_type: 'refresh_token',
    });
    let response: Response;
    try {
      response = await this.fetchImpl(this.tokenUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: body.toString(),
      });
    } catch {
      throw new CalendarError('network');
    }
    let data: TokenResponse = {};
    try {
      data = (await response.json()) as TokenResponse;
    } catch {
      // Not JSON: judged by the status below.
    }
    if (!response.ok || !data.access_token) {
      // invalid_grant: the refresh token was revoked or expired; invalid_client:
      // wrong ID or secret. Both need new values from the phone.
      if (response.status === 400 || response.status === 401) {
        throw new CalendarError('auth', response.status, data.error ?? 'refused');
      }
      throw new CalendarError(response.status === 429 ? 'ratelimit' : 'server', response.status);
    }
    const lifetime = typeof data.expires_in === 'number' && data.expires_in > 0 ? data.expires_in : 3600;
    this.token = {value: data.access_token, expiresAt: this.clock() + lifetime * 1000};
    return data.access_token;
  }
}
