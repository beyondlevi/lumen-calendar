// Configuration contract with the Lumen platform.
//
// On the glasses the platform injects `window.lumen.config`, backed by the
// fields declared under `lumen_config` in public/manifest.webmanifest and
// filled in on the phone companion (Apps tab): the Google OAuth client ID
// (text), its secret and the refresh token (secrets, kept on the glasses). They
// are never bundled, logged or typed in the app.
//
// In a regular browser (development only) `window.lumen` does not exist, so
// the values come from `?google.clientId=…` (and the other keys, plus
// `?google.api=…` to point the app at a mock server and `?dev.now=…` to fix the
// clock) and are kept in localStorage. The parameters are removed from the
// address bar right after they are read.
//
// Demo mode: the optional `demo` field set to anything but empty, 0, false, off
// or no, or `?demo=1` on the address (for this tab), shows built-in fictional
// calendars (src/demo) with no network.

export const CLIENT_ID_KEY = 'google.clientId';
export const CLIENT_SECRET_KEY = 'google.clientSecret';
export const REFRESH_TOKEN_KEY = 'google.refreshToken';
export const DEMO_KEY = 'demo';
/** Development and test only: one origin serving both the token and the Calendar API (a mock). */
export const API_ORIGIN_KEY = 'google.api';
/** Development and test only: the clock starts at this ISO date. */
export const DEV_NOW_KEY = 'dev.now';

export const REQUIRED_KEYS = [CLIENT_ID_KEY, CLIENT_SECRET_KEY, REFRESH_TOKEN_KEY] as const;
const URL_KEYS: readonly string[] = [...REQUIRED_KEYS, DEMO_KEY, API_ORIGIN_KEY, DEV_NOW_KEY];

export const DEV_STORAGE_KEY = 'lumen-calendar.dev-config';
export const DEMO_SESSION_KEY = 'lumen-calendar.demo';

export type ConfigValues = Record<string, string>;

export type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** The Calendar API base, without a trailing slash. */
  apiBase: string;
  tokenUrl: string;
};

export type ConfigState =
  | {status: 'loading'}
  | {status: 'missing'; missing: string[]}
  | {status: 'ready'; config: GoogleConfig}
  | {status: 'demo'};

type LumenConfigApi = {
  get(): Promise<ConfigValues>;
  onChange(callback: (values?: ConfigValues) => void): unknown;
};

declare global {
  /** What the Lumen host injects. */
  interface LumenHost {
    config?: LumenConfigApi;
  }
  interface Window {
    lumen?: LumenHost;
  }
}

export type ConfigSource = {
  kind: 'lumen' | 'dev';
  get(): Promise<ConfigValues>;
  /** Calls back with the new values when known, or with nothing (caller re-reads). */
  subscribe(callback: (values?: ConfigValues) => void): () => void;
};

/** The parts of `window` this module uses (lets tests pass a plain object). */
export type HostWindow = {
  location: {href: string};
  localStorage: Storage;
  sessionStorage: Storage;
  history: {state: unknown; replaceState(state: unknown, unused: string, url: string): void};
  addEventListener(type: 'storage', listener: (event: StorageEvent) => void): void;
  removeEventListener(type: 'storage', listener: (event: StorageEvent) => void): void;
  lumen?: {config?: LumenConfigApi};
};

function readDevConfig(storage: Storage): ConfigValues {
  try {
    const raw = storage.getItem(DEV_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed == null || typeof parsed !== 'object') {
      return {};
    }
    const values: ConfigValues = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') {
        values[key] = value;
      }
    }
    return values;
  } catch {
    return {};
  }
}

function isOn(value: string | null | undefined): boolean {
  const text = (value ?? '').trim().toLowerCase();
  return text !== '' && !['0', 'false', 'off', 'no'].includes(text);
}

/**
 * Reads the address: `?demo=1` turns demo mode on for this tab (`?demo=0` off)
 * everywhere; the other keys are stored only in development (`store`). All of
 * them are removed from the address bar.
 */
export function captureConfigFromUrl(store: boolean, win: HostWindow = window): void {
  const url = new URL(win.location.href);
  const keys = URL_KEYS.filter(key => url.searchParams.has(key));
  if (keys.length === 0) {
    return;
  }
  if (url.searchParams.has(DEMO_KEY)) {
    try {
      if (isOn(url.searchParams.get(DEMO_KEY))) {
        win.sessionStorage.setItem(DEMO_SESSION_KEY, '1');
      } else {
        win.sessionStorage.removeItem(DEMO_SESSION_KEY);
      }
    } catch {
      // Storage blocked: demo mode stays as it was.
    }
  }
  if (store) {
    const values = readDevConfig(win.localStorage);
    for (const key of keys.filter(key => key !== DEMO_KEY)) {
      const value = (url.searchParams.get(key) ?? '').trim();
      if (value) {
        values[key] = value;
      } else {
        delete values[key];
      }
    }
    try {
      win.localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(values));
    } catch {
      // Storage full or blocked: the values stay unavailable, which shows Setup.
    }
  }
  for (const key of keys) {
    url.searchParams.delete(key);
  }
  win.history.replaceState(win.history.state, '', url.pathname + url.search + url.hash);
}

export function demoForThisTab(win: Pick<HostWindow, 'sessionStorage'> = window): boolean {
  try {
    return win.sessionStorage.getItem(DEMO_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function getConfigSource(win: HostWindow = window): ConfigSource {
  const lumenConfig = win.lumen?.config;
  if (lumenConfig != null && typeof lumenConfig.get === 'function') {
    return {
      kind: 'lumen',
      get: () => lumenConfig.get(),
      subscribe(callback) {
        if (typeof lumenConfig.onChange !== 'function') {
          return () => {};
        }
        const unsubscribe = lumenConfig.onChange(values =>
          callback(values != null && typeof values === 'object' ? values : undefined),
        );
        return typeof unsubscribe === 'function' ? () => unsubscribe() : () => {};
      },
    };
  }

  return {
    kind: 'dev',
    get: () => Promise.resolve(readDevConfig(win.localStorage)),
    subscribe(callback) {
      const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === DEV_STORAGE_KEY) {
          callback();
        }
      };
      win.addEventListener('storage', onStorage);
      return () => win.removeEventListener('storage', onStorage);
    },
  };
}

const read = (values: ConfigValues | null | undefined, key: string): string => {
  const value = values?.[key];
  return typeof value === 'string' ? value.trim() : '';
};

/** A test origin over plain http is allowed only on this device. */
function apiOrigin(raw: string): string | null {
  try {
    const url = new URL(raw);
    const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    return url.protocol === 'https:' || (url.protocol === 'http:' && local) ? url.origin : null;
  } catch {
    return null;
  }
}

export function parseConfig(values: ConfigValues | null | undefined, demoTab = false): ConfigState {
  if (demoTab || isOn(values?.[DEMO_KEY])) {
    return {status: 'demo'};
  }
  const missing = REQUIRED_KEYS.filter(key => read(values, key) === '');
  if (missing.length > 0) {
    return {status: 'missing', missing};
  }
  const origin = read(values, API_ORIGIN_KEY) ? apiOrigin(read(values, API_ORIGIN_KEY)) : null;
  return {
    status: 'ready',
    config: {
      clientId: read(values, CLIENT_ID_KEY),
      clientSecret: read(values, CLIENT_SECRET_KEY),
      refreshToken: read(values, REFRESH_TOKEN_KEY),
      apiBase: origin ? `${origin}/calendar/v3` : 'https://www.googleapis.com/calendar/v3',
      tokenUrl: origin ? `${origin}/token` : 'https://oauth2.googleapis.com/token',
    },
  };
}

export function sameConfig(a: ConfigState, b: ConfigState): boolean {
  if (a.status !== b.status) {
    return false;
  }
  if (a.status === 'ready' && b.status === 'ready') {
    return (
      a.config.clientId === b.config.clientId &&
      a.config.clientSecret === b.config.clientSecret &&
      a.config.refreshToken === b.config.refreshToken &&
      a.config.apiBase === b.config.apiBase
    );
  }
  if (a.status === 'missing' && b.status === 'missing') {
    return a.missing.join() === b.missing.join();
  }
  return true;
}

/** Development and tests only: the fixed start of the clock, if any. */
export function devNow(values: ConfigValues | null | undefined): Date | null {
  const raw = read(values, DEV_NOW_KEY);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}
