import {Toast} from '@wearables-ui-toolkit/mrbd';
import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {devNow} from '../config/lumenConfig';
import {DemoBackend} from '../demo/demoBackend';
import {GoogleCalendarClient, type CalendarBackend, type Reply} from '../google/client';
import {CalendarError, asCalendarError} from '../google/errors';
import {compareEvents} from '../google/mapping';
import {TokenSource} from '../google/oauth';
import type {CalEvent, Calendar, NewEvent} from '../google/types';
import {t, type StringKey} from '../i18n/strings';
import {addDays, deviceTimeZone, now, setNow, startOfDay} from '../time/clock';
import {loadDraft, loadPrefs, loadTab, saveDraft, savePrefs, saveTab, type Prefs} from './storage';
import {useLumenConfig} from './useLumenConfig';

/** Today and the 7 days after it. */
const WINDOW_DAYS = 8;
const REFRESH_EVERY_MS = 5 * 60 * 1000;
/** The phone's internet can take 7 to 30 s to come up after the app opens. */
const NETWORK_RETRY_S = [2, 4, 8, 15];
const TICK_MS = 30 * 1000;
const DEMO_START = {hours: 14, minutes: 35};

export type Phase =
  | {kind: 'loading'}
  | {kind: 'setup'; reason: 'missing' | 'refused'}
  | {kind: 'ready'};

export type DataStatus =
  | {kind: 'loading'}
  /** Waiting for the internet, retrying on its own. */
  | {kind: 'connecting'}
  | {kind: 'ready'}
  | {kind: 'error'; error: CalendarError};

type CalendarState = {
  phase: Phase;
  status: DataStatus;
  calendars: Calendar[];
  /** Events of the shown calendars, today and the next 7 days, sorted. */
  events: CalEvent[];
  /** Start of today. */
  today: Date;
  /** Updated every 30 s, for "in 25 min". */
  current: Date;
  /** Counts the wearer's returns to the app (the page shown again). */
  resumes: number;
  retry(): void;
  /** Setup's Try again: re-reads the settings and loads again. */
  reconnect(): Promise<void>;

  tab: number;
  setTab(tab: number): void;
  draft: string;
  setDraft(text: string): void;

  isShown(calendar: Calendar): boolean;
  setShown(calendar: Calendar, shown: boolean): void;
  /** Where new events go: the chosen writable calendar, else the primary. */
  target: Calendar | null;
  writable: Calendar[];
  setTarget(calendar: Calendar): void;

  findEvent(calendarId: string, eventId: string): CalEvent | null;
  reply(event: CalEvent, response: Reply): Promise<boolean>;
  save(event: NewEvent): Promise<boolean>;
};

const CalendarContext = createContext<CalendarState | null>(null);

export function useCalendar(): CalendarState {
  const value = useContext(CalendarContext);
  if (!value) throw new Error('useCalendar outside CalendarProvider');
  return value;
}

const FAILURE_REASON: Record<CalendarError['kind'], StringKey> = {
  network: 'reasonNetwork',
  auth: 'reasonAuth',
  forbidden: 'reasonForbidden',
  notfound: 'reasonNotFound',
  ratelimit: 'reasonRate',
  server: 'reasonServer',
};

export function failureReason(error: unknown): string {
  return t(FAILURE_REASON[asCalendarError(error).kind]);
}

const REPLY_TOAST: Record<Reply, StringKey> = {accepted: 'repliedGoing', tentative: 'repliedMaybe', declined: 'repliedNo'};

function sortEvents(events: CalEvent[]): CalEvent[] {
  return [...events].sort(compareEvents);
}

export function CalendarProvider({children}: {children: ReactNode}) {
  const config = useLumenConfig();
  const [refused, setRefused] = useState(false);
  const [status, setStatus] = useState<DataStatus>({kind: 'loading'});
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loaded, setLoaded] = useState<CalEvent[]>([]);
  const [fetched, setFetched] = useState<ReadonlySet<string>>(new Set());
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [tab, setTabState] = useState(loadTab);
  const [draft, setDraftState] = useState(loadDraft);
  const [current, setCurrent] = useState(now);
  const [resumes, setResumes] = useState(0);

  const configState = config.state;
  const fixedNow = devNow(config.values)?.getTime() ?? null;

  // One backend per configuration; demo mode moves the clock to 14:35 today.
  const backend = useMemo<CalendarBackend | null>(() => {
    if (configState.status === 'demo') {
      const real = new Date();
      setNow(new Date(real.getFullYear(), real.getMonth(), real.getDate(), DEMO_START.hours, DEMO_START.minutes));
      return new DemoBackend(startOfDay(now()), deviceTimeZone(), t('noTitle'));
    }
    setNow(fixedNow == null ? null : new Date(fixedNow));
    if (configState.status !== 'ready') return null;
    const {clientId, clientSecret, refreshToken, apiBase, tokenUrl} = configState.config;
    const tokens = new TokenSource({clientId, clientSecret, refreshToken}, tokenUrl);
    return new GoogleCalendarClient(tokens, deviceTimeZone(), t('noTitle'), apiBase);
  }, [configState, fixedNow]);

  const backendRef = useRef(backend);
  backendRef.current = backend;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const generation = useRef(0);
  const hasData = useRef(false);

  const shownBy = useCallback((calendar: Calendar, from: Prefs) => from.shown[calendar.id] ?? calendar.selected, []);

  const windowRange = () => {
    const start = startOfDay(now());
    return {start, end: addDays(start, WINDOW_DAYS)};
  };

  /** Loads the calendars and the events of the shown ones. Network failures before any data retry on their own. */
  const load = useCallback(async (manual: boolean) => {
    const source = backendRef.current;
    if (!source) return;
    const run = ++generation.current;
    const alive = () => run === generation.current && backendRef.current === source;
    if (!hasData.current) setStatus({kind: 'loading'});
    for (let attempt = 0; ; attempt += 1) {
      try {
        const list = await source.listCalendars();
        const {start, end} = windowRange();
        const shown = list.filter(calendar => shownBy(calendar, prefsRef.current));
        const perCalendar = await Promise.all(shown.map(calendar => source.listEvents(calendar, start, end)));
        if (!alive()) return;
        hasData.current = true;
        setCalendars(list);
        setLoaded(sortEvents(perCalendar.flat()));
        setFetched(new Set(shown.map(calendar => calendar.id)));
        setCurrent(now());
        setStatus({kind: 'ready'});
        return;
      } catch (caught) {
        if (!alive()) return;
        const error = asCalendarError(caught);
        if (error.kind === 'auth') {
          setRefused(true);
          return;
        }
        if (hasData.current && !manual) {
          // A background refresh failed: keep what is on screen.
          return;
        }
        const delay = NETWORK_RETRY_S[attempt];
        if (error.kind !== 'network' || delay == null || hasData.current) {
          setStatus({kind: 'error', error});
          return;
        }
        setStatus({kind: 'connecting'});
        await new Promise(resolve => setTimeout(resolve, delay * 1000));
        if (!alive()) return;
      }
    }
  }, [shownBy]);

  // A new configuration starts over.
  useEffect(() => {
    hasData.current = false;
    setRefused(false);
    setCalendars([]);
    setLoaded([]);
    setFetched(new Set());
    if (backend) void load(false);
  }, [backend, load]);

  // Refresh when the wearer comes back to the app and every 5 minutes while it's open.
  useEffect(() => {
    if (!backend) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setCurrent(now());
        setResumes(count => count + 1);
        void load(false);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    const refresh = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(false);
    }, REFRESH_EVERY_MS);
    const tick = window.setInterval(() => setCurrent(now()), TICK_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(refresh);
      window.clearInterval(tick);
    };
  }, [backend, load]);

  const phase: Phase =
    configState.status === 'loading'
      ? {kind: 'loading'}
      : configState.status === 'missing'
        ? {kind: 'setup', reason: 'missing'}
        : refused
          ? {kind: 'setup', reason: 'refused'}
          : {kind: 'ready'};

  const retry = useCallback(() => void load(true), [load]);

  const reconnect = useCallback(async () => {
    const next = await config.reload();
    if (next.status === 'missing') {
      Toast.show(t('stillNotConnected'));
      return;
    }
    setRefused(false);
    hasData.current = false;
    await load(true);
  }, [config, load]);

  const setTab = useCallback((next: number) => {
    setTabState(next);
    saveTab(next);
  }, []);

  const setDraft = useCallback((text: string) => {
    setDraftState(text);
    saveDraft(text);
  }, []);

  const updatePrefs = useCallback((change: (previous: Prefs) => Prefs) => {
    setPrefs(previous => {
      const next = change(previous);
      savePrefs(next);
      return next;
    });
  }, []);

  const isShown = useCallback((calendar: Calendar) => shownBy(calendar, prefs), [prefs, shownBy]);

  const setShown = useCallback(
    (calendar: Calendar, shown: boolean) => {
      updatePrefs(previous => ({...previous, shown: {...previous.shown, [calendar.id]: shown}}));
      const source = backendRef.current;
      if (shown && source && !fetched.has(calendar.id)) {
        const {start, end} = windowRange();
        source.listEvents(calendar, start, end).then(
          events => {
            if (backendRef.current !== source) return;
            setLoaded(previous => sortEvents([...previous.filter(event => event.calendarId !== calendar.id), ...events]));
            setFetched(previous => new Set([...previous, calendar.id]));
          },
          () => {
            // Shown on the next refresh.
          },
        );
      }
    },
    [fetched, updatePrefs],
  );

  const writable = useMemo(() => calendars.filter(calendar => calendar.writable), [calendars]);
  const target = useMemo(
    () => writable.find(calendar => calendar.id === prefs.target) ?? writable.find(calendar => calendar.primary) ?? writable[0] ?? null,
    [prefs.target, writable],
  );
  const setTarget = useCallback((calendar: Calendar) => updatePrefs(previous => ({...previous, target: calendar.id})), [updatePrefs]);

  const events = useMemo(() => loaded.filter(event => {
    const calendar = calendars.find(entry => entry.id === event.calendarId);
    return calendar ? shownBy(calendar, prefs) : false;
  }), [calendars, loaded, prefs, shownBy]);

  const findEvent = useCallback(
    (calendarId: string, eventId: string) => loaded.find(event => event.calendarId === calendarId && event.id === eventId) ?? null,
    [loaded],
  );

  const replaceEvent = (updated: CalEvent) =>
    setLoaded(previous => previous.map(event => (event.calendarId === updated.calendarId && event.id === updated.id ? updated : event)));

  const reply = useCallback(async (event: CalEvent, response: Reply) => {
    const source = backendRef.current;
    const calendar = calendars.find(entry => entry.id === event.calendarId);
    if (!source || !calendar) return false;
    try {
      replaceEvent(await source.reply(event, calendar, response));
      Toast.show(t(REPLY_TOAST[response]));
      return true;
    } catch (error) {
      if (asCalendarError(error).kind === 'auth') setRefused(true);
      Toast.show(t('replyFailed', {reason: failureReason(error)}));
      return false;
    }
  }, [calendars]);

  const save = useCallback(async (event: NewEvent) => {
    const source = backendRef.current;
    if (!source || !target) return false;
    try {
      const created = await source.insertEvent(target, event);
      setLoaded(previous => sortEvents([...previous, created]));
      setFetched(previous => new Set([...previous, target.id]));
      if (!(prefsRef.current.shown[target.id] ?? target.selected)) {
        updatePrefs(previous => ({...previous, shown: {...previous.shown, [target.id]: true}}));
      }
      Toast.show(t('savedTo', {calendar: target.name}));
      return true;
    } catch (error) {
      if (asCalendarError(error).kind === 'auth') setRefused(true);
      Toast.show(t('saveFailed', {reason: failureReason(error)}));
      return false;
    }
  }, [target, updatePrefs]);

  const value: CalendarState = {
    phase,
    status,
    calendars,
    events,
    today: startOfDay(current),
    current,
    resumes,
    retry,
    reconnect,
    tab,
    setTab,
    draft,
    setDraft,
    isShown,
    setShown,
    target,
    writable,
    setTarget,
    findEvent,
    reply,
    save,
  };

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}
