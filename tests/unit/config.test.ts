import {describe, expect, it} from 'vitest';
import {DEMO_SESSION_KEY, DEV_STORAGE_KEY, captureConfigFromUrl, devNow, parseConfig, type HostWindow} from '../../src/config/lumenConfig';

const full = {'google.clientId': ' id.apps.googleusercontent.com ', 'google.clientSecret': 'secret', 'google.refreshToken': '1//refresh'};

describe('parseConfig', () => {
  it('lists the missing settings', () => {
    expect(parseConfig({})).toEqual({status: 'missing', missing: ['google.clientId', 'google.clientSecret', 'google.refreshToken']});
    expect(parseConfig({'google.clientId': 'x', 'google.refreshToken': '  '})).toEqual({status: 'missing', missing: ['google.clientSecret', 'google.refreshToken']});
  });

  it('uses Google with the three values, trimmed', () => {
    expect(parseConfig(full)).toEqual({
      status: 'ready',
      config: {
        clientId: 'id.apps.googleusercontent.com',
        clientSecret: 'secret',
        refreshToken: '1//refresh',
        apiBase: 'https://www.googleapis.com/calendar/v3',
        tokenUrl: 'https://oauth2.googleapis.com/token',
      },
    });
  });

  it('points at a mock only over https or on this device', () => {
    expect(parseConfig({...full, 'google.api': 'http://127.0.0.1:8090/'})).toMatchObject({config: {apiBase: 'http://127.0.0.1:8090/calendar/v3', tokenUrl: 'http://127.0.0.1:8090/token'}});
    expect(parseConfig({...full, 'google.api': 'http://example.com'})).toMatchObject({config: {apiBase: 'https://www.googleapis.com/calendar/v3'}});
  });

  it('turns demo mode on with any value but off words', () => {
    expect(parseConfig({demo: '1'})).toEqual({status: 'demo'});
    expect(parseConfig({demo: 'yes please'})).toEqual({status: 'demo'});
    expect(parseConfig({...full, demo: 'off'}).status).toBe('ready');
    expect(parseConfig({...full, demo: '0'}).status).toBe('ready');
    expect(parseConfig({}, true)).toEqual({status: 'demo'});
  });

  it('reads the development clock', () => {
    expect(devNow({'dev.now': '2026-10-09T14:35:00'})).toEqual(new Date(2026, 9, 9, 14, 35));
    expect(devNow({'dev.now': 'nope'})).toBeNull();
  });
});

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

function fakeWindow(href: string) {
  const replaced: string[] = [];
  const win: HostWindow = {
    location: {href},
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    history: {state: null, replaceState: (_state, _unused, url) => replaced.push(url)},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  return {win, replaced};
}

describe('captureConfigFromUrl', () => {
  it('stores development values and removes them from the address', () => {
    const {win, replaced} = fakeWindow('http://127.0.0.1:4173/?google.clientId=abc&google.refreshToken=r&x=1');
    captureConfigFromUrl(true, win);
    expect(JSON.parse(win.localStorage.getItem(DEV_STORAGE_KEY) ?? '{}')).toEqual({'google.clientId': 'abc', 'google.refreshToken': 'r'});
    expect(replaced).toEqual(['/?x=1']);
  });

  it('on the glasses, keeps nothing but still cleans the address; ?demo=1 is for this tab', () => {
    const {win, replaced} = fakeWindow('http://127.0.0.1:47100/?google.refreshToken=r&demo=1');
    captureConfigFromUrl(false, win);
    expect(win.localStorage.getItem(DEV_STORAGE_KEY)).toBeNull();
    expect(win.sessionStorage.getItem(DEMO_SESSION_KEY)).toBe('1');
    expect(replaced).toEqual(['/']);
  });
});
