# lumen-calendar

Google Calendar on [Rokid Lumen](https://github.com/beyondlevi/rokid-lumen) glasses, built as a Meta
Ray-Ban Display web app with the official [UI Toolkit for Meta Ray-Ban Display](https://github.com/facebook/meta-ray-ban-display-ui-toolkit-web):
today's agenda, the week, event details with your reply, and new events dictated or written with the band.

> **Unofficial.** Not affiliated with, endorsed or sponsored by Google LLC, Meta Platforms, Inc. or Rokid.
> Google Calendar is a trademark of Google LLC, used here only to say what the app works with.

**Status:** 0.1.0, offline package (`lumen-calendar.mrbd.zip`) for one Google account.

## What it does

Four peer tabs, moved between from the pill at the top (swipe up to it, then left and right):

- **Today** (the start screen): all-day events as chips, then today's timed events from the calendars you
  show, by start time. Each row has the start and end, the calendar's color, the title and
  "<meeting or place> · <calendar>". The next event that hasn't ended takes the focus and says
  "in 25 min" (or "now" while it runs); events already over stay in the list, dimmed.
- **Week**: the 7 days after today, grouped by day ("Tomorrow · Sat 10", "Sunday · 11 Oct"), all-day
  events with the sun.
- **New**: one real text field, "What, when and where". The index tap on it opens Lumen's composer,
  where you dictate or write with the band; then **Continue** shows what was understood.
- **Calendars**: every calendar of the account with its color and a switch (shown or not, kept on the
  glasses). The one marked "New events go here" receives new events (the primary calendar, until you
  pick another on the review screen).

Enter on an event opens it: the time, "Today · in 25 min", the video call, the place, the guests
("5 guests · 3 going, 1 maybe") and the description as plain text. When you are a guest, **Going**,
**Maybe** and **No** answer the invitation (the organizer is notified); your current answer is the
highlighted one.

The review of a new event shows the title, the day and time, the place and the calendar (Enter on the card
switches to the next calendar you can write to), with **Save**, **Edit** (back to the text) and
**Discard**. The text is read in your language, English or Portuguese, and in the other one when that
reads more of it:

| You say or write | The app understands |
| --- | --- |
| Lunch with Ana tomorrow at 1 pm at Coco Bambu | "Lunch with Ana", tomorrow 13:00–14:00, at Coco Bambu |
| Dentist on Monday at 9:30 for 2 hours | Monday 9:30–11:30 |
| Trip to Ubatuba on Saturday | all day Saturday |
| Almoço com a Ana amanhã às 13h no Coco Bambu | "Almoço com a Ana", amanhã 13:00–14:00, Coco Bambu |
| Reunião sexta das 15h às 17h na sala 3 | sexta 15:00–17:00, sala 3 |
| Academia amanhã às 7 da manhã por uma hora | amanhã 7:00–8:00 |

A place follows "at" (English) or "em", "no", "na" (Portuguese); an event lasts one hour unless you say how
long ("for 2 hours", "por 2 horas") or give an end; a date with no time makes an all-day event. When no date
or time is found, the review says so and **Edit** takes you back to the text.

The day refreshes when the app opens, when you come back to it, and every 5 minutes while it is open.
When the glasses' internet isn't up yet (the phone's can take 7 to 30 seconds), the first load retries
after 2, 4, 8 and 15 seconds; after that, and for any other failure, the screen says what happened and
offers **Try again**.

The band works as a D-pad: swipes move the focus, the index tap is Enter, the middle tap is Back. Back on an
event or the review returns to where you were; on Week, New or Calendars it goes to Today; on Today it
closes the app. English by default; Portuguese for any `pt-*` language of the glasses. Times follow the
glasses' locale (24-hour in `pt-BR` and `en-GB`, 12-hour in `en-US`).

## Setup (once, on a computer)

The app reads your calendar with your own Google OAuth client. You need about 10 minutes and a Google
account; it costs nothing.

1. **A Google Cloud project.** Open the [Google Cloud console](https://console.cloud.google.com/), create a
   project (any name, e.g. "Lumen Calendar") and select it.
2. **Enable the API.** APIs & Services > Library > **Google Calendar API** > Enable.
3. **The consent screen.** Menu > Google Auth platform > **Branding** (click Get started if asked): app
   name (e.g. "Calendar for Lumen"), your email as support and contact email; **Audience: External**;
   accept the user data policy and create.
4. **Publish it.** Google Auth platform > **Audience** > **Publish app**, so the publishing status is
   **In production**. While it is "Testing", Google makes the refresh token expire after 7 days and the app
   would ask you to connect again every week. You don't need Google's verification for your own use: when
   you sign in, Google warns that it hasn't verified the app; choose Advanced and continue to the app's
   name (it is your own project).
5. **The OAuth client.** Google Auth platform > **Clients** > Create client, application type
   **Desktop app**, any name. Keep the **client ID** and the **client secret** it shows.
6. **Get the refresh token.** With Node.js 18 or newer, in a copy of this repository:

   ```sh
   node scripts/google-auth.mjs <client-id> <client-secret>
   # or, to keep the secret out of the shell history:
   GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… node scripts/google-auth.mjs
   ```

   The script has no dependencies. It opens Google's consent page in the browser (and prints its address,
   for a computer without one: `--no-browser`). Sign in with the account whose calendar the glasses
   should show and allow access to your calendar. Google sends the answer back to the script on
   `127.0.0.1`, and the script prints the **refresh token**. It asks for `calendar.readonly` (to list your
   calendars) and `calendar.events` (to read events, reply and add events), with `access_type=offline`
   and `prompt=consent` so Google always gives a refresh token.
7. **On the phone**, open the Lumen companion > **Apps** > **Calendar** and fill in:

   | Setting | Value |
   | --- | --- |
   | Google OAuth client ID (`google.clientId`) | the client ID |
   | Google OAuth client secret (`google.clientSecret`, secret) | the client secret |
   | Google refresh token (`google.refreshToken`, secret) | the token from the script |
   | Demo mode (`demo`, optional) | leave empty |

   Secrets stay on the glasses: the companion only shows whether they are set. Open the app (or select
   **Try again** on its "Connect Google Calendar" screen) and your day shows up.

If Google later refuses the refresh token (you removed the app's access at
[myaccount.google.com/permissions](https://myaccount.google.com/permissions), the project went back to
"Testing", or more than 100 refresh tokens were made for this client and account, which drops the oldest),
the app shows the setup screen again: run the script once more and paste the new token.

## Privacy

- The app talks only to Google: `oauth2.googleapis.com` (to turn the refresh token into a short-lived
  access token) and `www.googleapis.com/calendar/v3` (your calendars and events). Nothing goes anywhere
  else; there is no server of ours, no analytics, no logging of what you see or type.
- The client secret and the refresh token come from the glasses' settings (`window.lumen.config`); they
  are never in the code, the package or a log. The access token lives in memory only and is dropped when
  the app closes.
- The glasses keep, in the app's own storage: which calendars you show, where new events go, the open tab
  and the text of an event not yet saved. Events are not stored.
- Requests carry only the `Authorization` and `Content-Type` headers.
- Dictation is done by Lumen's composer on your phone, with the engine you chose in the companion; the
  app only receives the text.

## Demo mode

Fictional calendars (Personal, Work, Holidays in Brazil, Birthdays) around today, at 14:35, with no network
and no Google account: set the companion's **Demo mode** setting to anything (`on`, `1`…; empty, `0`,
`off`, `false` or `no` turn it off), or open the app with `?demo=1` (for that tab; `?demo=0` turns it
off). Replies and new events work and are kept in memory until the app closes. Used for the screenshots
and the tests.

## Development

```sh
npm ci
npm run dev                 # then open /?demo=1 on the address Vite prints
npm run typecheck
npm test                    # unit tests (vitest)
npm run package             # dist/lumen-calendar.mrbd.zip, the package Lumen installs
npx playwright install chromium firefox
npm run test:e2e            # keyboard e2e on a mock Google, Chromium and Firefox (after npm run package)
npm run icons               # re-renders public/icon-*.png
```

- **Without the glasses**, there is no `window.lumen`: the settings come from the address once
  (`?google.clientId=…&google.clientSecret=…&google.refreshToken=…`) and stay in localStorage; the
  parameters are removed from the address bar right away. Two more keys exist for development only:
  `google.api` (an `http://127.0.0.1:<port>` or https origin serving `/token` and `/calendar/v3`, such as
  the mock) and `dev.now` (an ISO date where the clock starts).
- **Mock Google**: `node mock/server.mjs` serves the demo fixtures on `http://127.0.0.1:8090`, checks the
  OAuth values (`MOCK_*` in the file), allows only `Authorization` and `Content-Type` in its CORS
  preflight (a custom header fails, as with Google) and has controls to fail calls, expire access tokens
  and revoke the refresh token (`/__mock/*`). The e2e runner (`tests/e2e/run.mjs`) starts it and serves
  `dist/` and the unzipped package the way Lumen does; `E2E_BROWSERS=firefox` and `E2E_ONLY=<regex>`
  narrow a run, and screenshots go to `.e2e-output/` (the demo captures of every screen to
  `.e2e-output/captures/`).
- **Package**: `scripts/package-offline.mjs` zips `dist/` with `index.html` and `manifest.webmanifest` at
  the root, fixed dates (the same build gives the same zip), and checks the manifest: `id`
  `cloud.bynd.lumen.calendar`, `version` equal to `package.json`, a square PNG icon of at least 192 px,
  `lumen_internet: true` and the `lumen_config` keys above. Install it with Lumen's
  `scripts/push-webapp.sh lumen-calendar.mrbd.zip` or from the companion (Apps > Add > Offline package
  from a file).
- **Layout**: `src/google` (OAuth token source, API client, mapping), `src/parse/eventText.ts` (the
  sentence parser, chrono-node `en` and `pt`), `src/state/CalendarProvider.tsx` (loading, refresh,
  replies, saves), `src/pages` (the screens), `src/i18n/strings.ts` (every string, English and
  Portuguese), `src/demo` (fixtures shared with the mock).
- The engine on the glasses is GeckoView (Firefox 156); the build targets it (`firefox128`). Read
  [AGENTS.md](AGENTS.md) before changing the app.

## Limits

- One Google account. Recurring events show each occurrence; editing or deleting events and creating
  recurring ones are not in the app (use Google Calendar on the phone).
- Video call links are shown, not opened: an offline app can't open another site.
- A long description is cut on the glasses.
- The sentence parser understands English and Portuguese only.

## License

MIT, see [LICENSE](LICENSE).
