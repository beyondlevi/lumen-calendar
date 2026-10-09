import {spawn} from 'node:child_process';
import path from 'node:path';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {MOCK_AUTH_CODE, MOCK_CLIENT_ID, MOCK_CLIENT_SECRET, MOCK_REFRESH_TOKEN, startMockServer} from '../../mock/server.mjs';

const PORT = 8091;
const script = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../scripts/google-auth.mjs');
let server;

beforeAll(async () => {
  server = await startMockServer(PORT);
});
afterAll(() => server.close());

/** Runs the script until it prints the consent address; resolves with it and the finished output. */
function run(args) {
  const child = spawn(process.execPath, [script, ...args, '--no-browser'], {
    env: {...process.env, GOOGLE_AUTH_TEST_TOKEN_URL: `http://127.0.0.1:${PORT}/token`},
  });
  let output = '';
  const exited = new Promise(resolve => child.on('close', code => resolve({code, output})));
  const consent = new Promise((resolve, reject) => {
    const onData = chunk => {
      output += chunk.toString();
      const match = /https:\/\/accounts\.google\.com\/\S+/.exec(output);
      if (match) resolve(new URL(match[0]));
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('close', () => reject(new Error(output)));
  });
  return {consent, exited};
}

describe('scripts/google-auth.mjs', () => {
  it('asks for offline access to the calendar with PKCE on a loopback address, then prints the refresh token', async () => {
    const {consent, exited} = run([MOCK_CLIENT_ID, MOCK_CLIENT_SECRET]);
    const url = await consent;
    const params = Object.fromEntries(url.searchParams);
    expect(params).toMatchObject({
      client_id: MOCK_CLIENT_ID,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events',
      code_challenge_method: 'S256',
    });
    expect(params.redirect_uri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    expect(params.code_challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);

    // Something else knocking on the port is turned away.
    const stranger = await fetch(`${params.redirect_uri}?state=wrong&code=${encodeURIComponent(MOCK_AUTH_CODE)}`);
    expect(stranger.status).toBe(400);

    const answer = await fetch(`${params.redirect_uri}?state=${params.state}&code=${encodeURIComponent(MOCK_AUTH_CODE)}`);
    expect(answer.status).toBe(200);
    const {code, output} = await exited;
    expect(code).toBe(0);
    expect(output).toContain(MOCK_REFRESH_TOKEN);
    expect(output).toContain('Lumen > Apps > Calendar');
  });

  it('reports a refused consent', async () => {
    const {consent, exited} = run([MOCK_CLIENT_ID, MOCK_CLIENT_SECRET]);
    const params = Object.fromEntries((await consent).searchParams);
    await fetch(`${params.redirect_uri}?state=${params.state}&error=access_denied`);
    const {code, output} = await exited;
    expect(code).toBe(1);
    expect(output).toContain('access_denied');
  });

  it('explains its use without the client ID and secret', async () => {
    const child = spawn(process.execPath, [script], {env: {PATH: process.env.PATH ?? ''}});
    let output = '';
    child.stderr.on('data', chunk => (output += chunk.toString()));
    const code = await new Promise(resolve => child.on('close', resolve));
    expect(code).toBe(2);
    expect(output).toContain('Usage: node scripts/google-auth.mjs <clientId> <clientSecret>');
  });
});
