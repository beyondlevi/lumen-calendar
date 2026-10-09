// A stand-in for Google (oauth2.googleapis.com/token and the Calendar API v3)
// for the e2e tests. It answers from the same fictional fixtures as demo mode,
// placed around the day the app asks for, and, like Google, allows only the
// Authorization and Content-Type request headers in its CORS preflight.
//
//   node mock/server.mjs              (listens on 127.0.0.1:8090)
//   POST /token                       refresh_token grant: MOCK_REFRESH_TOKEN gives an access token;
//                                     authorization_code grant (scripts/google-auth.mjs): MOCK_AUTH_CODE
//                                     with a PKCE verifier gives MOCK_REFRESH_TOKEN
//   GET  /calendar/v3/users/me/calendarList
//   GET  /calendar/v3/calendars/{id}/events?timeMin&timeMax
//   POST /calendar/v3/calendars/{id}/events
//   PATCH /calendar/v3/calendars/{id}/events/{eventId}?sendUpdates=all
//
// Test controls (any method):
//   /__mock/reset          forget writes, failures and tokens
//   /__mock/writes         the inserts and patches received
//   /__mock/stats          token requests and the headers asked for in preflights
//   /__mock/fail?status=500&count=N | ?network=1&count=N   the next N Calendar calls fail
//   /__mock/expire         access tokens issued so far are refused with 401
//   /__mock/revoke         the refresh token is refused (invalid_grant)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const MOCK_PORT = 8090;
export const MOCK_CLIENT_ID = 'mock-client.apps.googleusercontent.com';
export const MOCK_CLIENT_SECRET = 'mock-client-secret';
export const MOCK_REFRESH_TOKEN = '1//mock-refresh-token';
export const MOCK_AUTH_CODE = '4/mock-auth-code';

const ALLOWED_HEADERS = 'Authorization, Content-Type';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH',
  'Access-Control-Allow-Headers': ALLOWED_HEADERS,
};

const fixtures = JSON.parse(fs.readFileSync(path.join(root, 'src/demo/fixtures.json'), 'utf8'));

function pad(value) {
  return String(value).padStart(2, '0');
}

function dateOnly(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The fixtures as Google sends them, with "today" starting at dayStart (the app's local midnight). */
function materialize(dayStart) {
  const day = offset => new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + offset);
  const at = (offset, time) => {
    const [hours, minutes] = time.split(':').map(Number);
    const base = day(offset);
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes).toISOString();
  };
  return fixtures.events.map(({day: offset, start, end, allDayDays, mockOnly: _mockOnly, ...event}) => ({
    ...event,
    start: allDayDays ? {date: dateOnly(day(offset))} : {dateTime: at(offset, start)},
    end: allDayDays ? {date: dateOnly(day(offset + allDayDays))} : {dateTime: at(offset, end)},
  }));
}

function bounds(event) {
  const parse = value => (value.dateTime ? new Date(value.dateTime) : new Date(`${value.date}T00:00:00`));
  return [parse(event.start), parse(event.end)];
}

export function startMockServer(port = MOCK_PORT, host = '127.0.0.1') {
  let state;
  const reset = () => {
    state = {
      writes: [],
      created: [],
      patches: new Map(),
      fail: null,
      tokens: new Set(),
      issued: 0,
      tokenRequests: 0,
      revoked: false,
      preflightHeaders: new Set(),
    };
  };
  reset();

  const send = (res, status, body) => {
    res.writeHead(status, {'Content-Type': 'application/json; charset=UTF-8', ...CORS});
    res.end(JSON.stringify(body));
  };
  const googleError = (res, status, reason, message) => send(res, status, {error: {code: status, message, errors: [{reason, message}]}});

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${host}:${port}`);
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      if (req.method === 'OPTIONS') {
        const asked = (req.headers['access-control-request-headers'] ?? '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
        asked.forEach(header => state.preflightHeaders.add(header));
        const allowed = ALLOWED_HEADERS.toLowerCase().split(', ');
        if (asked.some(header => !allowed.includes(header))) {
          // Google answers a preflight with an unexpected header with 403.
          res.writeHead(403);
          return res.end();
        }
        res.writeHead(204, {...CORS, 'Access-Control-Max-Age': '0'});
        return res.end();
      }

      if (url.pathname.startsWith('/__mock/')) {
        const control = url.pathname.slice('/__mock/'.length);
        if (control === 'reset') reset();
        if (control === 'expire') state.tokens.clear();
        if (control === 'revoke') state.revoked = true;
        if (control === 'fail') {
          state.fail = {
            status: Number(url.searchParams.get('status') ?? 500),
            network: url.searchParams.get('network') === '1',
            count: Number(url.searchParams.get('count') ?? 1),
          };
        }
        if (control === 'writes') return send(res, 200, state.writes);
        if (control === 'stats') {
          return send(res, 200, {tokenRequests: state.tokenRequests, preflightHeaders: [...state.preflightHeaders].sort()});
        }
        return send(res, 200, {ok: true});
      }

      if (url.pathname === '/token' && req.method === 'POST') {
        state.tokenRequests += 1;
        const form = new URLSearchParams(body);
        if (form.get('grant_type') === 'authorization_code') {
          const ok =
            form.get('code') === MOCK_AUTH_CODE &&
            form.get('client_id') === MOCK_CLIENT_ID &&
            form.get('client_secret') === MOCK_CLIENT_SECRET &&
            /^http:\/\/127\.0\.0\.1:\d+\/$/.test(form.get('redirect_uri') ?? '') &&
            (form.get('code_verifier') ?? '').length >= 43;
          return ok
            ? send(res, 200, {access_token: 'mock-access-0', expires_in: 3599, refresh_token: MOCK_REFRESH_TOKEN, token_type: 'Bearer'})
            : send(res, 400, {error: 'invalid_grant', error_description: 'Bad Request'});
        }
        const valid =
          form.get('grant_type') === 'refresh_token' &&
          form.get('client_id') === MOCK_CLIENT_ID &&
          form.get('client_secret') === MOCK_CLIENT_SECRET &&
          form.get('refresh_token') === MOCK_REFRESH_TOKEN;
        if (!valid || state.revoked) {
          return send(res, 400, {error: 'invalid_grant', error_description: 'Token has been expired or revoked.'});
        }
        state.issued += 1;
        const token = `mock-access-${state.issued}`;
        state.tokens.add(token);
        return send(res, 200, {access_token: token, expires_in: 3599, scope: 'calendar', token_type: 'Bearer'});
      }

      if (!url.pathname.startsWith('/calendar/v3/')) {
        return googleError(res, 404, 'notFound', 'Not Found');
      }
      const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
      if (!state.tokens.has(token)) {
        return googleError(res, 401, 'authError', 'Invalid Credentials');
      }
      if (state.fail && state.fail.count > 0) {
        state.fail.count -= 1;
        if (state.fail.network) {
          req.socket.destroy();
          return;
        }
        return googleError(res, state.fail.status, 'backendError', 'Backend Error');
      }

      const pathname = url.pathname.slice('/calendar/v3'.length);
      if (pathname === '/users/me/calendarList' && req.method === 'GET') {
        return send(res, 200, {kind: 'calendar#calendarList', items: fixtures.calendars});
      }

      const match = /^\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/.exec(pathname);
      if (!match) return googleError(res, 404, 'notFound', 'Not Found');
      const calendarId = decodeURIComponent(match[1]);
      const eventId = match[2] ? decodeURIComponent(match[2]) : null;
      if (!fixtures.calendars.some(calendar => calendar.id === calendarId)) {
        return googleError(res, 404, 'notFound', 'Not Found');
      }

      if (req.method === 'GET' && !eventId) {
        const timeMin = new Date(url.searchParams.get('timeMin'));
        const timeMax = new Date(url.searchParams.get('timeMax'));
        if (Number.isNaN(timeMin.getTime()) || Number.isNaN(timeMax.getTime())) {
          return googleError(res, 400, 'badRequest', 'Bad Request');
        }
        const items = [...materialize(timeMin), ...state.created]
          .filter(event => event.calendarId === calendarId)
          .map(event => ({...event, ...(state.patches.get(`${calendarId}/${event.id}`) ?? {})}))
          .filter(event => {
            const [start, end] = bounds(event);
            return start < timeMax && end > timeMin;
          })
          .sort((a, b) => bounds(a)[0] - bounds(b)[0])
          .map(({calendarId: _calendarId, ...event}) => event);
        return send(res, 200, {kind: 'calendar#events', items});
      }

      if (req.method === 'POST' && !eventId) {
        const event = JSON.parse(body || '{}');
        const created = {...event, id: `created${state.created.length + 1}`, status: 'confirmed', calendarId};
        state.created.push(created);
        state.writes.push({method: 'POST', calendarId, body: event});
        const {calendarId: _calendarId, ...response} = created;
        return send(res, 200, response);
      }

      if (req.method === 'PATCH' && eventId) {
        const change = JSON.parse(body || '{}');
        state.writes.push({method: 'PATCH', calendarId, eventId, sendUpdates: url.searchParams.get('sendUpdates'), body: change});
        const key = `${calendarId}/${eventId}`;
        state.patches.set(key, {...(state.patches.get(key) ?? {}), ...change});
        const today = new Date();
        const all = [...materialize(new Date(today.getFullYear(), today.getMonth(), today.getDate())), ...state.created];
        const original = all.find(event => event.calendarId === calendarId && event.id === eventId);
        if (!original) return googleError(res, 404, 'notFound', 'Not Found');
        const {calendarId: _calendarId, ...response} = {...original, ...state.patches.get(key)};
        return send(res, 200, response);
      }

      return googleError(res, 405, 'methodNotAllowed', 'Method Not Allowed');
    });
  });
  return new Promise(resolve => server.listen(port, host, () => resolve(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await startMockServer();
  console.log(`Google mock on http://127.0.0.1:${MOCK_PORT}`);
}
