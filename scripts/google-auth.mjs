#!/usr/bin/env node
// Gets the Google refresh token for Calendar for Lumen, once, on a computer.
// No dependencies: Node 18 or newer.
//
//   node scripts/google-auth.mjs <clientId> <clientSecret>
//   (or GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… node scripts/google-auth.mjs,
//   which keeps the secret out of the shell history)
//
// It starts a server on 127.0.0.1 (a free port), opens Google's consent page
// in the browser (and prints its address), takes the code Google sends back to
// that server, trades it for tokens and prints the refresh token. The OAuth
// client must be of type "Desktop app"; its loopback redirect accepts any port.
// Nothing is written to disk and nothing is sent anywhere but Google.
import {spawn} from 'node:child_process';
import {createHash, randomBytes} from 'node:crypto';
import http from 'node:http';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar.events'];
const TIMEOUT_MS = 5 * 60 * 1000;

// For this script's own tests only: a token endpoint on this computer.
const testTokenUrl = process.env.GOOGLE_AUTH_TEST_TOKEN_URL;
const TOKEN_URL = testTokenUrl && /^http:\/\/127\.0\.0\.1:\d+\//.test(testTokenUrl) ? testTokenUrl : 'https://oauth2.googleapis.com/token';

const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const noBrowser = process.argv.includes('--no-browser');
const clientId = (args[0] ?? process.env.GOOGLE_CLIENT_ID ?? '').trim();
const clientSecret = (args[1] ?? process.env.GOOGLE_CLIENT_SECRET ?? '').trim();

if (!clientId || !clientSecret) {
  console.error(
    [
      'Usage: node scripts/google-auth.mjs <clientId> <clientSecret> [--no-browser]',
      '   or: GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… node scripts/google-auth.mjs',
      '',
      'The client ID and secret come from Google Cloud Console > APIs & Services >',
      'Credentials, an OAuth client of type "Desktop app" (see the README).',
    ].join('\n'),
  );
  process.exit(2);
}
if (!clientId.endsWith('.apps.googleusercontent.com') && !testTokenUrl) {
  console.warn('Warning: a Google client ID usually ends with .apps.googleusercontent.com.');
}

const base64url = buffer => buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const state = base64url(randomBytes(16));
const verifier = base64url(randomBytes(48));
const challenge = base64url(createHash('sha256').update(verifier).digest());

function page(title, body) {
  return `<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="font-family: system-ui, sans-serif; background: #000; color: #fff; padding: 2rem; line-height: 1.5">
<h1 style="font-weight: 500">${title}</h1><p>${body}</p></body>`;
}

function openBrowser(url) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const commandArgs = process.platform === 'win32' ? ['/c', 'start', '""', url.replace(/&/g, '^&')] : [url];
  try {
    const child = spawn(command, commandArgs, {stdio: 'ignore', detached: true});
    child.on('error', () => {});
    child.unref();
  } catch {
    // No browser here: the address is printed anyway.
  }
}

async function exchange(code, redirectUri) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Google refused the code (${response.status}): ${data.error ?? ''} ${data.error_description ?? ''}`.trim());
  }
  return data;
}

const server = http.createServer();
let finished = false;

function finish(code, message) {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  if (message) (code === 0 ? console.log : console.error)(message);
  server.close();
  process.exitCode = code;
}

const timer = setTimeout(() => finish(1, '\nNo answer from Google in 5 minutes. Run the script again.'), TIMEOUT_MS);

server.on('request', async (req, res) => {
  const {port} = server.address();
  const redirectUri = `http://127.0.0.1:${port}/`;
  const url = new URL(req.url, redirectUri);
  if (url.pathname !== '/') {
    res.writeHead(404).end();
    return;
  }
  const send = (status, title, body) => {
    res.writeHead(status, {'Content-Type': 'text/html; charset=utf-8'});
    res.end(page(title, body));
  };
  if (url.searchParams.get('state') !== state) {
    send(400, 'Unexpected request', 'This address only takes Google’s answer to the script that opened it.');
    return;
  }
  const error = url.searchParams.get('error');
  if (error) {
    send(400, 'Not allowed', `Google said: ${error}. You can close this tab and run the script again.`);
    finish(1, `\nGoogle did not give access: ${error}.`);
    return;
  }
  const code = url.searchParams.get('code');
  if (!code) {
    send(400, 'No code', 'Google sent no code. Run the script again.');
    return;
  }
  try {
    const tokens = await exchange(code, redirectUri);
    if (!tokens.refresh_token) {
      send(500, 'No refresh token', 'Google sent no refresh token. See the terminal.');
      finish(
        1,
        '\nGoogle sent no refresh token. Remove the app\'s access at https://myaccount.google.com/permissions and run the script again.',
      );
      return;
    }
    send(200, 'Done', 'Calendar for Lumen has its refresh token. You can close this tab and go back to the terminal.');
    finish(
      0,
      [
        '',
        'Refresh token (keep it private, like a password):',
        '',
        `  ${tokens.refresh_token}`,
        '',
        'On your phone, open Lumen > Apps > Calendar and fill in:',
        '  Google OAuth client ID      the client ID you used here',
        '  Google OAuth client secret  the client secret you used here',
        '  Google refresh token        the token above',
        '',
        'If the token stops working after 7 days, the consent screen is still in "Testing":',
        'publish it ("In production") and run this script again.',
      ].join('\n'),
    );
  } catch (exchangeError) {
    send(500, 'Something went wrong', 'See the terminal.');
    finish(1, `\n${exchangeError.message}`);
  }
});

server.listen(0, '127.0.0.1', () => {
  const {port} = server.address();
  const consent = new URL(AUTH_URL);
  consent.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `http://127.0.0.1:${port}/`,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  console.log('Open this address, sign in with the Google account whose calendar the glasses show, and allow access:\n');
  console.log(`  ${consent}\n`);
  console.log(`Waiting for Google on http://127.0.0.1:${port}/ …`);
  if (!noBrowser) openBrowser(consent.toString());
});
