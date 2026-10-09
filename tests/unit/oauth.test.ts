import {describe, expect, it, vi} from 'vitest';
import {CalendarError} from '../../src/google/errors';
import {TokenSource} from '../../src/google/oauth';

const CREDENTIALS = {clientId: 'client-id', clientSecret: 'client-secret', refreshToken: 'refresh-token'};
const TOKEN_URL = 'https://oauth.test/token';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
}

function setup(responses: (() => Response | Promise<Response>)[]) {
  let clock = 1_000_000;
  const calls: {url: string; init: RequestInit}[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({url: String(url), init: init ?? {}});
    const next = responses.shift();
    if (!next) throw new Error('unexpected request');
    return next();
  });
  const source = new TokenSource(CREDENTIALS, TOKEN_URL, fetchImpl, () => clock);
  return {source, calls, advance: (ms: number) => (clock += ms)};
}

describe('TokenSource', () => {
  it('asks for a token with the refresh token, as a form, with no other header', async () => {
    const {source, calls} = setup([() => json({access_token: 'a1', expires_in: 3600})]);
    expect(await source.get()).toBe('a1');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(TOKEN_URL);
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers).toEqual({'Content-Type': 'application/x-www-form-urlencoded'});
    expect(Object.fromEntries(new URLSearchParams(String(calls[0].init.body)))).toEqual({
      client_id: 'client-id',
      client_secret: 'client-secret',
      refresh_token: 'refresh-token',
      grant_type: 'refresh_token',
    });
  });

  it('keeps the token until about a minute before it expires', async () => {
    const {source, calls, advance} = setup([
      () => json({access_token: 'a1', expires_in: 3600}),
      () => json({access_token: 'a2', expires_in: 3600}),
    ]);
    expect(await source.get()).toBe('a1');
    advance(3600_000 - 61_000);
    expect(await source.get()).toBe('a1');
    expect(calls).toHaveLength(1);
    advance(2_000);
    expect(await source.get()).toBe('a2');
    expect(calls).toHaveLength(2);
  });

  it('shares one renewal between callers', async () => {
    const {source, calls} = setup([() => json({access_token: 'a1', expires_in: 3600})]);
    const tokens = await Promise.all([source.get(), source.get(), source.refresh()]);
    expect(tokens).toEqual(['a1', 'a1', 'a1']);
    expect(calls).toHaveLength(1);
  });

  it('drops a token Google rejected, but not a newer one', async () => {
    const {source, calls} = setup([
      () => json({access_token: 'a1', expires_in: 3600}),
      () => json({access_token: 'a2', expires_in: 3600}),
    ]);
    await source.get();
    source.invalidate('old-token');
    expect(await source.get()).toBe('a1');
    source.invalidate('a1');
    expect(await source.get()).toBe('a2');
    expect(calls).toHaveLength(2);
  });

  it('reports a refused refresh token as auth (the Setup screen)', async () => {
    const {source} = setup([() => json({error: 'invalid_grant', error_description: 'Token has been expired or revoked.'}, 400)]);
    await expect(source.get()).rejects.toMatchObject({kind: 'auth', status: 400});
  });

  it('reports a network failure and a server error apart', async () => {
    const offline = setup([() => Promise.reject(new TypeError('NetworkError'))]);
    await expect(offline.source.get()).rejects.toBeInstanceOf(CalendarError);
    await expect(setup([() => Promise.reject(new TypeError('x'))]).source.get()).rejects.toMatchObject({kind: 'network'});
    await expect(setup([() => json({}, 503)]).source.get()).rejects.toMatchObject({kind: 'server', status: 503});
  });

  it('tries again after a failed renewal', async () => {
    const {source} = setup([() => Promise.reject(new TypeError('offline')), () => json({access_token: 'a1', expires_in: 3600})]);
    await expect(source.get()).rejects.toMatchObject({kind: 'network'});
    expect(await source.get()).toBe('a1');
  });
});
