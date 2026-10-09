// What the app keeps on the glasses: which calendars are shown and where new
// events go (localStorage), and the open tab and the unsaved event text
// (sessionStorage, so they survive the page being reloaded by Android).

const PREFS_KEY = 'lumen-calendar.prefs';
const TAB_KEY = 'lumen-calendar.tab';
const DRAFT_KEY = 'lumen-calendar.draft';

export type Prefs = {
  /** Calendar ID → shown. A calendar not listed follows Google's own "selected" flag. */
  shown: Record<string, boolean>;
  /** Where new events go; null means the primary calendar. */
  target: string | null;
};

function safeGet(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: () => Storage, key: string, value: string | null): void {
  try {
    if (value == null) storage().removeItem(key);
    else storage().setItem(key, value);
  } catch {
    // Storage full or blocked: the choice lasts until the app closes.
  }
}

const local = () => window.localStorage;
const session = () => window.sessionStorage;

export function loadPrefs(): Prefs {
  try {
    const parsed: unknown = JSON.parse(safeGet(local, PREFS_KEY) ?? '{}');
    const value = parsed != null && typeof parsed === 'object' ? (parsed as Partial<Prefs>) : {};
    const shown: Record<string, boolean> = {};
    if (value.shown && typeof value.shown === 'object') {
      for (const [id, flag] of Object.entries(value.shown)) {
        if (typeof flag === 'boolean') shown[id] = flag;
      }
    }
    return {shown, target: typeof value.target === 'string' ? value.target : null};
  } catch {
    return {shown: {}, target: null};
  }
}

export function savePrefs(prefs: Prefs): void {
  safeSet(local, PREFS_KEY, JSON.stringify(prefs));
}

export function loadTab(): number {
  const value = Number(safeGet(session, TAB_KEY));
  return Number.isInteger(value) && value >= 0 && value <= 3 ? value : 0;
}

export function saveTab(tab: number): void {
  safeSet(session, TAB_KEY, String(tab));
}

export function loadDraft(): string {
  return safeGet(session, DRAFT_KEY) ?? '';
}

export function saveDraft(text: string): void {
  safeSet(session, DRAFT_KEY, text ? text : null);
}
