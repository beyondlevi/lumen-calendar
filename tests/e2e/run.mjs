// Keyboard-only end-to-end tests against the mock Google server (mock/server.mjs).
//
//   npm run package && npm run test:e2e              (Chromium + Firefox)
//   E2E_BROWSERS=firefox npm run test:e2e
//   E2E_ONLY='reply' npm run test:e2e                (scenarios whose title matches)
//
// The built app is served like the Lumen host serves a package (static files,
// SPA fallback) on 127.0.0.1:4173 and the mock on 127.0.0.1:8090, so every call
// is a real cross-origin request with a CORS preflight, as with Google. The
// offline package scenarios unzip dist/lumen-calendar.mrbd.zip, serve that on
// 127.0.0.1:5500 with every other origin blocked, and save the demo-mode
// captures of every screen to .e2e-output/captures/.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {unzipSync} from 'fflate';
import {chromium, firefox} from 'playwright';
import {MOCK_CLIENT_ID, MOCK_CLIENT_SECRET, MOCK_PORT, MOCK_REFRESH_TOKEN, startMockServer} from '../../mock/server.mjs';
import {startStaticServer} from './static-server.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const outDir = path.join(root, '.e2e-output');
const capturesDir = path.join(outDir, 'captures');
const MOCK = `http://127.0.0.1:${MOCK_PORT}`;
const APP = 'http://127.0.0.1:4173';
const PACKAGE_APP = 'http://127.0.0.1:5500';
const browsers = (process.env.E2E_BROWSERS ?? 'chromium,firefox').split(',');
const only = process.env.E2E_ONLY ? new RegExp(process.env.E2E_ONLY, 'i') : null;
const results = [];
let lastPage = null;

fs.mkdirSync(capturesDir, {recursive: true});

const control = (name, query = '') => fetch(`${MOCK}/__mock/${name}${query}`, {method: 'POST'}).then(response => response.json());

/** Today at 14:35, local time, as the app's clock start. */
function todayAt(hours, minutes) {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(hours)}:${pad(minutes)}:00`;
}

const google = {
  'google.clientId': MOCK_CLIENT_ID,
  'google.clientSecret': MOCK_CLIENT_SECRET,
  'google.refreshToken': MOCK_REFRESH_TOKEN,
  'google.api': MOCK,
  'dev.now': todayAt(14, 35),
};

async function focusLabel(page) {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body) return '(body)';
    return (element.getAttribute('aria-label') || element.textContent || element.tagName).replace(/\s+/g, ' ').trim();
  });
}

async function press(page, key, times = 1) {
  for (let i = 0; i < times; i += 1) {
    await page.keyboard.press(key);
    await page.waitForTimeout(350);
  }
}

/** Moves focus with `key` until its label matches, or fails. */
async function focusUntil(page, key, pattern, limit = 12) {
  for (let i = 0; i <= limit; i += 1) {
    const label = await focusLabel(page);
    if (pattern.test(label)) return label;
    await press(page, key);
  }
  throw new Error(`focus never matched ${pattern}; last: ${await focusLabel(page)}`);
}

async function waitText(page, text, timeout = 10000) {
  // Components may keep hidden copies of a text (measuring, transitions): wait for a visible one.
  await page.getByText(text, {exact: false}).filter({visible: true}).first().waitFor({state: 'visible', timeout});
}

/** Like Lumen's composer: the text goes in through the value setter, `input`, then `change`. */
async function compose(page, text) {
  await page.evaluate(value => {
    const field = document.activeElement;
    if (!(field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement)) throw new Error('no text field focused');
    const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, value);
    field.dispatchEvent(new Event('input', {bubbles: true}));
    field.dispatchEvent(new Event('change', {bubbles: true}));
  }, text);
  await page.waitForTimeout(300);
}

async function openApp(browser, name, config, {appUrl = APP, route = '/', locale = 'en-GB', blockOthers = false} = {}) {
  const context = await browser.newContext({viewport: {width: 600, height: 600}, locale});
  await context.addInitScript(values => {
    if (!sessionStorage.getItem('e2e-config-set')) {
      localStorage.setItem('lumen-calendar.dev-config', JSON.stringify(values));
      sessionStorage.setItem('e2e-config-set', '1');
    }
  }, config);
  const outside = [];
  if (blockOthers) {
    await context.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith(appUrl)) return route.continue();
      // The Lumen host points Google Fonts at a bundled Noto Sans; anything else must not be asked for.
      if (!/fonts\.(googleapis|gstatic)\.com/.test(url)) outside.push(url);
      return route.abort();
    });
  }
  const page = await context.newPage();
  lastPage = page;
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`${appUrl}${route}`);
  const shot = step => page.screenshot({path: path.join(outDir, `${name}-${step}.png`)});
  return {page, context, errors, outside, shot};
}

async function capture(page, file) {
  await page.waitForTimeout(900);
  await page.screenshot({path: path.join(capturesDir, file)});
}

const scenarios = {
  async 'setup without settings, then Try again connects'(browser, name) {
    await control('reset');
    const {page, context, errors, shot} = await openApp(browser, name, {});
    await waitText(page, 'Connect Google Calendar');
    await waitText(page, 'Fill in the client ID, the secret and the refresh token.');
    assert.match(await focusLabel(page), /Try again/);
    await shot('setup');
    await press(page, 'Enter');
    await waitText(page, 'Still not connected');
    await page.evaluate(values => localStorage.setItem('lumen-calendar.dev-config', JSON.stringify(values)), google);
    await press(page, 'Enter');
    await waitText(page, 'Design review');
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'today: past events dimmed, the next one focused with "in 25 min"'(browser, name) {
    await control('reset');
    const {page, context, errors, shot} = await openApp(browser, name, google);
    await waitText(page, 'Design review');
    await waitText(page, 'in 25 min');
    await waitText(page, 'Team sync');
    await waitText(page, "Mom's birthday");
    await page.waitForTimeout(800);
    assert.match(await focusLabel(page), /^Design review, 15:00 – 16:00, Google Meet · Work, in 25 min$/);
    // Birthdays is not selected in Google, so its events stay hidden.
    assert.equal(await page.getByText("Bruno's birthday").count(), 0);
    await shot('today');
    await focusUntil(page, 'ArrowUp', /Team sync/, 3);
    await focusUntil(page, 'ArrowDown', /Gym/, 4);
    // Only Authorization and Content-Type were ever asked for in a preflight.
    const stats = await fetch(`${MOCK}/__mock/stats`).then(response => response.json());
    assert.ok(stats.preflightHeaders.every(header => ['authorization', 'content-type'].includes(header)), stats.preflightHeaders.join());
    assert.equal(stats.tokenRequests, 1);
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'week: the next 7 days by day, Back goes to Today'(browser, name) {
    await control('reset');
    const {page, context, errors, shot} = await openApp(browser, name, google);
    await waitText(page, 'Design review');
    await focusUntil(page, 'ArrowUp', /Page 1 of 4/);
    await press(page, 'ArrowRight');
    await waitText(page, 'Tomorrow ·');
    await waitText(page, 'Lunch with Ana');
    await waitText(page, 'Trip to Ubatuba');
    await waitText(page, 'All day · Personal');
    await shot('week');
    await focusUntil(page, 'ArrowDown', /Standup/, 3);
    await focusUntil(page, 'ArrowDown', /Trip to Ubatuba/, 6);
    await press(page, 'Escape');
    await page.waitForTimeout(600);
    await focusUntil(page, 'ArrowUp', /Page 1 of 4/, 6);
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'event: details, reply Maybe (events.patch, sendUpdates=all), Back restores focus'(browser, name) {
    await control('reset');
    const {page, context, errors, shot} = await openApp(browser, name, google);
    await waitText(page, 'Design review');
    await page.waitForTimeout(800);
    await press(page, 'Enter');
    await waitText(page, 'meet.google.com/abc-defg-hij');
    await waitText(page, 'Room 3 · Av. Paulista, 1000');
    await waitText(page, '5 guests · 3 going, 1 maybe');
    await waitText(page, 'Bring the latest prototype & notes.');
    await waitText(page, 'Today · in 25 min');
    assert.equal(new URL(page.url()).pathname, '/event/work.team%40group.calendar.google.com/evdesignreview');
    // The details take the focus (they scroll); the answers are below them.
    await page.waitForTimeout(700);
    assert.match(await focusLabel(page), /Event details/);
    await focusUntil(page, 'ArrowDown', /Going|Maybe|^No$/, 2);
    await focusUntil(page, 'ArrowLeft', /Going/, 2);
    await shot('event');
    await focusUntil(page, 'ArrowRight', /Maybe/, 2);
    await press(page, 'Enter');
    await waitText(page, 'You might go');
    await waitText(page, '5 guests · 2 going, 2 maybe');
    const writes = await fetch(`${MOCK}/__mock/writes`).then(response => response.json());
    assert.equal(writes.length, 1);
    assert.equal(writes[0].method, 'PATCH');
    assert.equal(writes[0].eventId, 'evdesignreview');
    assert.equal(writes[0].sendUpdates, 'all');
    assert.deepEqual(
      writes[0].body.attendees.map(attendee => [attendee.email, attendee.responseStatus]),
      [
        ['ana.souza@example.com', 'tentative'],
        ['marco@example.com', 'accepted'],
        ['julia@example.com', 'accepted'],
        ['rafael@example.com', 'tentative'],
        ['lena@example.com', 'needsAction'],
        ['room3@resource.calendar.google.com', 'accepted'],
      ],
    );
    await shot('replied');
    await press(page, 'Escape');
    await waitText(page, 'Call with Andy');
    await page.waitForTimeout(800);
    assert.equal(new URL(page.url()).pathname, '/');
    assert.match(await focusLabel(page), /^Design review/);
    // An event where the owner isn't a guest has no reply actions.
    await focusUntil(page, 'ArrowDown', /Gym/, 3);
    await press(page, 'Enter');
    await waitText(page, 'Smart Fit Paulista');
    assert.equal(await page.getByText('Maybe', {exact: true}).count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'new event through the real text field, review, save'(browser, name) {
    await control('reset');
    const {page, context, errors, shot} = await openApp(browser, name, google);
    await waitText(page, 'Design review');
    await focusUntil(page, 'ArrowUp', /Page 1 of 4/);
    await press(page, 'ArrowRight', 2);
    await page.locator('textarea[aria-label="New event: what, when and where"]').waitFor({state: 'attached'});
    await press(page, 'ArrowDown');
    // The focused element is the text field itself, and Enter on it is not prevented,
    // so on the glasses it opens Lumen's composer.
    const field = await page.evaluate(() => {
      const element = document.activeElement;
      window.__enter = null;
      // Captured first, read after every handler ran: was it prevented, and was it the field's?
      window.addEventListener(
        'keydown',
        event => {
          if (event.key === 'Enter') setTimeout(() => (window.__enter = {prevented: event.defaultPrevented, target: event.target === element}));
        },
        true,
      );
      return {tag: element?.tagName, label: element?.getAttribute('aria-label'), disabled: element?.disabled, readOnly: element?.readOnly};
    });
    assert.deepEqual(field, {tag: 'TEXTAREA', label: 'New event: what, when and where', disabled: false, readOnly: false});
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    assert.deepEqual(await page.evaluate(() => window.__enter), {prevented: false, target: true});
    await compose(page, 'Lunch with Ana tomorrow at 1 pm at Coco Bambu');
    await shot('written');
    await focusUntil(page, 'ArrowDown', /Continue/, 3);
    await press(page, 'Enter');
    await waitText(page, 'Check it');
    await waitText(page, 'Lunch with Ana');
    await waitText(page, '13:00 – 14:00');
    await waitText(page, 'Coco Bambu');
    await waitText(page, 'One hour, unless you say how long');
    await page.waitForTimeout(600);
    assert.match(await focusLabel(page), /Save/);
    await shot('review');
    // Edit goes back to the field with the text.
    await focusUntil(page, 'ArrowRight', /Edit/, 2);
    await press(page, 'Enter');
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'TEXTAREA');
    assert.equal(await page.evaluate(() => document.activeElement?.value), 'Lunch with Ana tomorrow at 1 pm at Coco Bambu');
    await focusUntil(page, 'ArrowDown', /Continue/, 3);
    await press(page, 'Enter');
    await waitText(page, 'Check it');
    await page.waitForTimeout(600);
    assert.match(await focusLabel(page), /Save/);
    await press(page, 'Enter');
    await waitText(page, 'Saved to Personal');
    await page.waitForTimeout(800);
    assert.equal(new URL(page.url()).pathname, '/');
    assert.match(await focusLabel(page), /^Design review/);
    const writes = await fetch(`${MOCK}/__mock/writes`).then(response => response.json());
    assert.equal(writes.length, 1);
    assert.equal(writes[0].method, 'POST');
    assert.equal(writes[0].calendarId, 'ana.souza@example.com');
    assert.equal(writes[0].body.summary, 'Lunch with Ana');
    assert.equal(writes[0].body.location, 'Coco Bambu');
    const start = new Date(writes[0].body.start.dateTime);
    const end = new Date(writes[0].body.end.dateTime);
    assert.equal(start.getHours(), 13);
    assert.equal(end.getTime() - start.getTime(), 60 * 60 * 1000);
    assert.equal(new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime() - new Date(todayAt(0, 0)).getTime(), 24 * 60 * 60 * 1000);
    assert.ok(writes[0].body.start.timeZone);
    // The field is empty again and the event is in the week.
    await focusUntil(page, 'ArrowUp', /Page 1 of 4/);
    await press(page, 'ArrowRight');
    await waitText(page, 'Lunch with Ana');
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'new event: no date says so and offers Edit; Discard empties the field'(browser, name) {
    await control('reset');
    const {page, context, errors, shot} = await openApp(browser, name, google);
    await waitText(page, 'Design review');
    await focusUntil(page, 'ArrowUp', /Page 1 of 4/);
    await press(page, 'ArrowRight', 2);
    await press(page, 'ArrowDown');
    await compose(page, 'Buy milk');
    await focusUntil(page, 'ArrowDown', /Continue/, 3);
    await press(page, 'Enter');
    await waitText(page, 'No date or time found');
    await page.waitForTimeout(600);
    assert.match(await focusLabel(page), /Edit/);
    await shot('no-date');
    await focusUntil(page, 'ArrowRight', /Discard/, 2);
    await press(page, 'Enter');
    await page.waitForTimeout(800);
    assert.equal(new URL(page.url()).pathname, '/');
    await focusUntil(page, 'ArrowUp', /Page 1 of 4/, 4);
    await press(page, 'ArrowRight', 2);
    await press(page, 'ArrowDown');
    assert.equal(await page.evaluate(() => document.activeElement?.value), '');
    assert.deepEqual(await fetch(`${MOCK}/__mock/writes`).then(response => response.json()), []);
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'new event in Portuguese, in another calendar picked on Review'(browser, name) {
    await control('reset');
    const {page, context, errors, shot} = await openApp(browser, name, google, {locale: 'pt-BR'});
    await waitText(page, 'Design review');
    await focusUntil(page, 'ArrowUp', /Página 1 de 4|Page 1 of 4/);
    await press(page, 'ArrowRight', 2);
    await press(page, 'ArrowDown');
    await compose(page, 'Reunião amanhã das 15h às 17h na sala 3');
    await focusUntil(page, 'ArrowDown', /Continuar/, 3);
    await press(page, 'Enter');
    await waitText(page, 'Confira');
    await waitText(page, '15:00 – 17:00');
    await waitText(page, 'sala 3');
    await page.waitForTimeout(600);
    await focusUntil(page, 'ArrowUp', /Agenda: Personal/, 2);
    await press(page, 'Enter');
    await waitText(page, 'Work');
    assert.match(await focusLabel(page), /Agenda: Work/);
    await shot('review-pt');
    await focusUntil(page, 'ArrowDown', /Salvar|Editar|Descartar/, 2);
    await focusUntil(page, 'ArrowLeft', /Salvar/, 2);
    await press(page, 'Enter');
    await waitText(page, 'Salvo em Work');
    const writes = await fetch(`${MOCK}/__mock/writes`).then(response => response.json());
    assert.equal(writes[0].calendarId, 'work.team@group.calendar.google.com');
    assert.equal(writes[0].body.summary, 'Reunião');
    assert.equal(writes[0].body.location, 'sala 3');
    assert.equal(new Date(writes[0].body.end.dateTime) - new Date(writes[0].body.start.dateTime), 2 * 60 * 60 * 1000);
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'calendars: show Birthdays, it is kept, events appear'(browser, name) {
    await control('reset');
    const {page, context, errors, shot} = await openApp(browser, name, google);
    await waitText(page, 'Design review');
    await focusUntil(page, 'ArrowUp', /Page 1 of 4/);
    await press(page, 'ArrowRight', 3);
    await waitText(page, 'Holidays in Brazil');
    await waitText(page, 'New events go here');
    await shot('calendars');
    await focusUntil(page, 'ArrowDown', /Birthdays/, 6);
    await press(page, 'Enter');
    await page.waitForTimeout(800);
    const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('lumen-calendar.prefs') ?? '{}'));
    assert.equal(prefs.shown['addressbook#contacts@group.v.calendar.google.com'], true);
    await focusUntil(page, 'ArrowUp', /Page 4 of 4/, 6);
    await press(page, 'ArrowLeft', 2);
    await waitText(page, "Bruno's birthday");
    // Hidden again after a reload, where it was turned off.
    await focusUntil(page, 'ArrowUp', /Page 2 of 4/, 6);
    await press(page, 'ArrowRight', 2);
    await focusUntil(page, 'ArrowDown', /Work/, 6);
    await press(page, 'Enter');
    await page.reload();
    // The open tab survives the reload.
    await waitText(page, 'Holidays in Brazil');
    await focusUntil(page, 'ArrowUp', /Page 4 of 4/, 6);
    await press(page, 'ArrowLeft', 3);
    await waitText(page, "Mom's birthday");
    assert.equal(await page.getByText('Design review').count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'errors: Google failing shows Try again, which recovers'(browser, name) {
    await control('reset');
    await control('fail', '?status=500&count=99');
    const {page, context, errors, shot} = await openApp(browser, name, google);
    await waitText(page, 'Google Calendar is not answering');
    await waitText(page, 'HTTP 500');
    assert.match(await focusLabel(page), /Try again/);
    await shot('server-error');
    await control('fail', '?status=500&count=0');
    await press(page, 'Enter');
    await waitText(page, 'Design review');
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'errors: no internet at launch is retried on its own'(browser, name) {
    await control('reset');
    await control('fail', '?network=1&count=2');
    const {page, context, errors} = await openApp(browser, name, google);
    await waitText(page, 'Design review', 20000);
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'token: an expired access token is renewed once and the call repeated'(browser, name) {
    await control('reset');
    const {page, context, errors} = await openApp(browser, name, google);
    await waitText(page, 'Design review');
    await page.waitForTimeout(800);
    await control('expire');
    await press(page, 'Enter');
    await waitText(page, 'meet.google.com/abc-defg-hij');
    await page.waitForTimeout(700);
    await focusUntil(page, 'ArrowDown', /Going|Maybe|^No$/, 2);
    await focusUntil(page, 'ArrowRight', /^No$/, 3);
    await press(page, 'Enter');
    await waitText(page, "You're not going");
    const stats = await fetch(`${MOCK}/__mock/stats`).then(response => response.json());
    assert.equal(stats.tokenRequests, 2);
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'token: a refused refresh token shows Setup'(browser, name) {
    await control('reset');
    await control('revoke');
    const {page, context, errors, shot} = await openApp(browser, name, google);
    await waitText(page, 'Connect Google Calendar');
    await waitText(page, 'Google refused the saved refresh token');
    await shot('refused');
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'offline package, demo mode: every screen, no request off the package'(browser, name) {
    const {page, context, errors, outside} = await openApp(browser, name, {}, {appUrl: PACKAGE_APP, route: '/?demo=1', blockOthers: true});
    const prefix = browser.browserType().name();
    await waitText(page, 'Design review');
    await waitText(page, 'in 25 min');
    await capture(page, `${prefix}-01-today.png`);
    await focusUntil(page, 'ArrowUp', /Page 1 of 4/);
    await press(page, 'ArrowRight');
    await waitText(page, 'Trip to Ubatuba');
    await press(page, 'ArrowDown');
    await capture(page, `${prefix}-02-week.png`);
    await focusUntil(page, 'ArrowUp', /Page 2 of 4/, 6);
    await press(page, 'ArrowLeft');
    await press(page, 'ArrowDown');
    await focusUntil(page, 'ArrowDown', /Design review/, 3);
    await press(page, 'Enter');
    await waitText(page, '5 guests · 3 going, 1 maybe');
    await capture(page, `${prefix}-03-event.png`);
    await press(page, 'Escape');
    await waitText(page, 'Call with Andy');
    await page.waitForTimeout(600);
    await focusUntil(page, 'ArrowUp', /Page 1 of 4/);
    await press(page, 'ArrowRight', 2);
    await press(page, 'ArrowDown');
    await capture(page, `${prefix}-04-new-event.png`);
    await compose(page, 'Lunch with Ana tomorrow at 1 pm at Coco Bambu');
    await capture(page, `${prefix}-05-new-event-written.png`);
    await focusUntil(page, 'ArrowDown', /Continue/, 3);
    await press(page, 'Enter');
    await waitText(page, 'Check it');
    await capture(page, `${prefix}-06-review.png`);
    await press(page, 'Enter');
    await waitText(page, 'Saved to Personal');
    await capture(page, `${prefix}-07-saved.png`);
    await focusUntil(page, 'ArrowUp', /Page 1 of 4/, 4);
    await press(page, 'ArrowRight', 3);
    await waitText(page, 'Holidays in Brazil');
    await press(page, 'ArrowDown');
    await capture(page, `${prefix}-08-calendars.png`);
    assert.deepEqual(outside, []);
    assert.deepEqual(errors, []);
    await context.close();

    // Setup, from the same package with no settings.
    const setup = await openApp(browser, `${name}-setup`, {}, {appUrl: PACKAGE_APP, blockOthers: true});
    await waitText(setup.page, 'Connect Google Calendar');
    await capture(setup.page, `${prefix}-09-setup.png`);
    assert.deepEqual(setup.outside, []);
    await setup.context.close();
  },

  async 'offline package, demo mode from the demo setting, in Portuguese'(browser, name) {
    const {page, context, errors, outside} = await openApp(browser, name, {demo: 'on'}, {appUrl: PACKAGE_APP, locale: 'pt-BR', blockOthers: true});
    const prefix = browser.browserType().name();
    await waitText(page, 'em 25 min');
    await capture(page, `${prefix}-pt-01-today.png`);
    await focusUntil(page, 'ArrowUp', /Página 1 de 4|Page 1 of 4/);
    await press(page, 'ArrowRight', 2);
    await page.locator('textarea[aria-label="Novo evento: o quê, quando e onde"]').waitFor({state: 'attached'});
    await press(page, 'ArrowDown');
    await compose(page, 'Almoço com a Ana amanhã às 13h no Coco Bambu');
    await focusUntil(page, 'ArrowDown', /Continuar/, 3);
    await press(page, 'Enter');
    await waitText(page, 'Confira');
    await waitText(page, 'Almoço com a Ana');
    await capture(page, `${prefix}-pt-02-review.png`);
    assert.deepEqual(outside, []);
    assert.deepEqual(errors, []);
    await context.close();
  },
};

const mockServer = await startMockServer();
const appServer = await startStaticServer(path.join(root, 'dist'), 4173);
const packageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-calendar-package-'));
for (const [file, data] of Object.entries(unzipSync(fs.readFileSync(path.join(root, 'dist/lumen-calendar.mrbd.zip'))))) {
  fs.mkdirSync(path.dirname(path.join(packageDir, file)), {recursive: true});
  fs.writeFileSync(path.join(packageDir, file), data);
}
const packageServer = await startStaticServer(packageDir, 5500);

try {
  for (const browserName of browsers) {
    const browser = await (browserName === 'firefox' ? firefox : chromium).launch();
    for (const [title, scenario] of Object.entries(scenarios)) {
      if (only && !only.test(title)) continue;
      const name = `${browserName}-${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`.slice(0, 80);
      try {
        await scenario(browser, name);
        results.push(['pass', browserName, title]);
      } catch (error) {
        results.push(['FAIL', browserName, title, String(error?.message ?? error).split('\n').slice(0, Number(process.env.E2E_LINES ?? 2)).join(' ')]);
        await lastPage?.screenshot({path: path.join(outDir, `${name}-FAILED.png`)}).catch(() => {});
        await lastPage?.context().close().catch(() => {});
      }
    }
    await browser.close();
  }
} finally {
  mockServer.close();
  appServer.close();
  packageServer.close();
}

for (const [status, browserName, title, detail] of results) {
  console.log(`${status} ${browserName}: ${title}${detail ? ` — ${detail}` : ''}`);
}
if (results.some(([status]) => status === 'FAIL')) {
  process.exit(1);
}
