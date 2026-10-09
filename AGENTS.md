# Working on this app

A [Rokid Lumen](https://github.com/beyondlevi/rokid-lumen) web app: a Meta Ray-Ban Display (MRBD) web
app (React + Vite + TypeScript, the official [UI Toolkit for Meta Ray-Ban Display](https://github.com/facebook/meta-ray-ban-display-ui-toolkit-web))
that Lumen runs offline on Rokid glasses from a `.mrbd.zip` package. Lumen's guide for apps is
[docs/building-apps.md](https://github.com/beyondlevi/rokid-lumen/blob/main/docs/building-apps.md).

## Rules

- **Text goes in through real text fields.** Every place that takes text (an event, list items, a
  name) is a focusable `<input>` (text/search) or `<textarea>`: `Enter` on it opens Lumen's composer,
  which offers both **dictation** and **writing with the band** (handwriting), and returns the text
  through `input` and `change` events. Never build a dictation-only screen on `SpeechRecognition` or
  `window.lumen.audio`: it drops handwriting. Don't `preventDefault()` Enter on a text field.
- **English first, multilingual from the start.** All user-visible text lives in the locale files,
  English is the default and the fallback, Portuguese (`pt`) ships with it. Use placeholders and
  plurals, never string concatenation. Dates and times through `Intl` in the wearer's locale.
  Code, comments, docs and commits in English.
- **The band drives it as a D-pad.** Swipes are arrow keys, the index tap is `Enter`, the middle tap is
  Back (`Escape`: call `preventDefault()` only when the app handled it). Every control is focusable,
  with a visible focus state, and focus is restored when coming back to a screen.
- **GeckoView only** (Firefox 156 on the glasses). No Chromium 95 workarounds.
- **Secrets come from `window.lumen.config`** (filled in on the phone's Lumen companion, Apps tab),
  never from the code or the repository. Never log them.
- **Demo mode** (`demo` config key, or `?demo=1`) shows realistic fake data with no network, for
  screenshots and tests.

## Commands

- `npm run dev`, `npm run typecheck`, `npm test` (unit), `npm run test:e2e` (Playwright on a mock server)
- `npm run package` builds `dist/<name>.mrbd.zip`, the package Lumen installs.
