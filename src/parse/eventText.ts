// Understands a dictated or written event ("Lunch with Ana tomorrow at 1 pm at
// Coco Bambu", "Almoço com a Ana amanhã às 13h no Coco Bambu"): the date and
// time with chrono-node, a duration ("for 2 hours", "por 2 horas"), the place
// ("at …", "em/no/na …") and what is left as the title.
import * as en from 'chrono-node/en';
import * as pt from 'chrono-node/pt';

export type ParseLanguage = 'en' | 'pt';

export type ParsedEvent = {
  title: string;
  location: string | null;
  /** Null when no date or time was found. */
  start: Date | null;
  /** Exclusive; null with `start`. */
  end: Date | null;
  allDay: boolean;
  /** True when the end is the one-hour default (no end or duration was said). */
  defaultDuration: boolean;
};

const DEFAULT_MINUTES = 60;
const SPAN = ' \u0000 ';

type Span = {index: number; length: number};

type DurationRule = {pattern: RegExp; minutes(match: RegExpExecArray): number};

const UNIT_WORDS: Record<string, number> = {a: 1, an: 1, one: 1, um: 1, uma: 1};

function amount(word: string): number {
  return UNIT_WORDS[word.toLowerCase()] ?? Number(word.replace(',', '.'));
}

const DURATIONS: Record<ParseLanguage, DurationRule[]> = {
  en: [
    {pattern: /\bfor\s+half\s+an?\s+hour\b/i, minutes: () => 30},
    {pattern: /\bfor\s+(\d{1,2})h(\d{2})\b/i, minutes: m => Number(m[1]) * 60 + Number(m[2])},
    {
      pattern: /\bfor\s+(an?|one|\d+(?:[.,]\d+)?)\s*(?:hours?|hrs?|h)\b(?:\s*(?:and\s+)?(?:(a\s+half)|(\d+)\s*(?:minutes?|mins?|m)\b))?/i,
      minutes: m => amount(m[1]) * 60 + (m[2] ? 30 : m[3] ? Number(m[3]) : 0),
    },
    {pattern: /\bfor\s+(\d+)\s*(?:minutes?|mins?|m)\b/i, minutes: m => Number(m[1])},
  ],
  pt: [
    {pattern: /\b(?:por|durante)\s+meia\s+hora\b/i, minutes: () => 30},
    {pattern: /\b(?:por|durante)\s+(\d{1,2})h(\d{2})\b/i, minutes: m => Number(m[1]) * 60 + Number(m[2])},
    {
      pattern: /\b(?:por|durante)\s+(uma|um|\d+(?:[.,]\d+)?)\s*(?:horas?|h)\b(?:\s*e\s+(?:(meia)|(\d+)\s*(?:minutos?|min)\b))?/i,
      minutes: m => amount(m[1]) * 60 + (m[2] ? 30 : m[3] ? Number(m[3]) : 0),
    },
    {pattern: /\b(?:por|durante)\s+(\d+)\s*(?:minutos?|min)\b/i, minutes: m => Number(m[1])},
  ],
};

const PERIOD_OFFSET: Record<string, number> = {manhã: 0, manha: 0, madrugada: 0, tarde: 12, noite: 12};

function clock(hour: string, minute?: string): string {
  return `${Number(hour)}:${minute ?? '00'}`;
}

/** Spoken Portuguese times chrono doesn't read: "13h", "10h30", "3 da tarde", "das 15h às 17h". */
function normalizePortuguese(text: string): string {
  return text
    .replace(/\bmeio[- ]dia\b/gi, '12:00')
    .replace(/\bmeia[- ]noite\b/gi, '0:00')
    .replace(/\b(\d{1,2})(?::(\d{2})|h(\d{2})?)?\s*(?:horas?\s+)?da\s+(manhã|manha|madrugada|tarde|noite)/gi, (_match, hour: string, minute, hMinute, period: string) => {
      let value = Number(hour) % 12;
      value += PERIOD_OFFSET[period.toLowerCase()] ?? 0;
      return clock(String(value), minute ?? hMinute);
    })
    .replace(/\b(\d{1,2})h(\d{2})?\b/gi, (_match, hour: string, minute?: string) => clock(hour, minute))
    .replace(
      /\b(?:das|de|entre)\s+(\d{1,2})(?::(\d{2}))?\s+(?:às|as|até|ate|a|e)\s+(\d{1,2})(?::(\d{2}))?(?!\s*de\s)\b/gi,
      (_match, h1: string, m1, h2: string, m2) => `${clock(h1, m1)} - ${clock(h2, m2)}`,
    );
}

const DANGLING_END: Record<ParseLanguage, RegExp> = {
  en: /[\s,]+(?:on|at|in|from|by|this|next|the|for|until|starting|and)$/i,
  pt: /[\s,]+(?:no|na|nos|nas|em|dia|às|as|à|a|de|do|da|desta|deste|nesta|neste|esta|este|próxima|próximo|proxima|proximo|até|ate|e)$/i,
};
const DANGLING_START: Record<ParseLanguage, RegExp> = {
  en: /^(?:,|and|then)\s+/i,
  pt: /^(?:,|e|depois)\s+/i,
};
const PLACE: Record<ParseLanguage, RegExp> = {
  en: /^(.+?)\s+at\s+(.+)$/i,
  pt: /^(.+?)\s+(?:em|no|na|nos|nas)\s+(.+)$/i,
};

function cleanSegment(segment: string, language: ParseLanguage): string {
  let value = segment.trim();
  for (let previous = ''; previous !== value; ) {
    previous = value;
    value = value.replace(DANGLING_END[language], '').replace(DANGLING_START[language], '').trim();
  }
  return value;
}

function trimPunctuation(text: string): string {
  return text.replace(/^[\s,.;:–-]+|[\s,.;:–-]+$/g, '');
}

function removeSpans(text: string, spans: Span[]): string {
  let result = text;
  for (const span of [...spans].sort((a, b) => b.index - a.index)) {
    result = result.slice(0, span.index) + SPAN + result.slice(span.index + span.length);
  }
  return result;
}

function atTime(day: Date, time: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes());
}

function dayStart(date: Date, plusDays = 0): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + plusDays);
}

type Attempt = {
  start: Date | null;
  end: Date | null;
  allDay: boolean;
  defaultDuration: boolean;
  remainder: string;
  /** Characters of the text read as the date, time and duration. */
  matched: number;
};

function attempt(text: string, language: ParseLanguage, now: Date): Attempt {
  let working = language === 'pt' ? normalizePortuguese(text) : text;

  let durationMinutes: number | null = null;
  let durationLength = 0;
  for (const rule of DURATIONS[language]) {
    const match = rule.pattern.exec(working);
    if (match) {
      const minutes = rule.minutes(match);
      if (Number.isFinite(minutes) && minutes > 0) {
        durationMinutes = minutes;
        durationLength = match[0].length;
        working = removeSpans(working, [{index: match.index, length: match[0].length}]);
        break;
      }
    }
  }

  const parser = language === 'pt' ? pt.casual : en.casual;
  const results = parser.parse(working, now, {forwardDate: true});
  if (results.length === 0) {
    return {start: null, end: null, allDay: false, defaultDuration: false, remainder: working, matched: 0};
  }

  const base = results[0];
  const spans: Span[] = [{index: base.index, length: base.text.length}];
  let start = base.start.date();
  let hourKnown = base.start.isCertain('hour');
  let end = base.end ? base.end.date() : null;
  const hasDay = (result: (typeof results)[number]) => result.start.isCertain('day') || result.start.isCertain('weekday');

  for (const next of results.slice(1)) {
    if (!next.start.isCertain('hour') || hasDay(next)) continue;
    if (!hourKnown) {
      // "amanhã" … "às 7": the date from the first, the time from this one.
      start = atTime(start, next.start.date());
      hourKnown = true;
      if (next.end) end = atTime(start, next.end.date());
    } else if (end == null) {
      // "sexta das 15:00" … "17:00": the end of the range.
      end = atTime(start, next.start.date());
    } else {
      continue;
    }
    spans.push({index: next.index, length: next.text.length});
  }

  const remainder = removeSpans(working, spans);
  const matched = durationLength + spans.reduce((sum, span) => sum + span.length, 0);
  if (!hourKnown) {
    const first = dayStart(start);
    const last = end ? dayStart(end, 1) : dayStart(first, 1);
    return {start: first, end: last > first ? last : dayStart(first, 1), allDay: true, defaultDuration: false, remainder, matched};
  }

  let defaultDuration = false;
  if (end != null && end <= start) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  if (end == null) {
    defaultDuration = durationMinutes == null;
    end = new Date(start.getTime() + (durationMinutes ?? DEFAULT_MINUTES) * 60_000);
  }
  return {start, end, allDay: false, defaultDuration, remainder, matched};
}

function splitTitle(remainder: string, language: ParseLanguage): {title: string; location: string | null} {
  const joined = remainder
    .split('\u0000')
    .map(segment => cleanSegment(segment, language))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const place = PLACE[language].exec(joined);
  let title = trimPunctuation(place ? place[1] : joined);
  let location = place ? trimPunctuation(place[2]) : '';
  if (!title && location) {
    title = location;
    location = '';
  }
  title = title.charAt(0).toLocaleUpperCase() + title.slice(1);
  return {title, location: location || null};
}

/**
 * Parses in the wearer's language and in the other one (dictation can be in
 * another language than the app's): the wearer's wins unless the other reads
 * more of the text as a date and time.
 */
export function parseEventText(text: string, language: ParseLanguage, now: Date): ParsedEvent {
  const clean = text.replace(/\s+/g, ' ').trim();
  const other: ParseLanguage = language === 'pt' ? 'en' : 'pt';
  const own = attempt(clean, language, now);
  const alternative = attempt(clean, other, now);
  const chosen =
    alternative.start && (!own.start || alternative.matched > own.matched)
      ? {attempt: alternative, language: other}
      : own.start
        ? {attempt: own, language}
        : null;
  if (!chosen) {
    const {title, location} = splitTitle(clean, language);
    return {title, location, start: null, end: null, allDay: false, defaultDuration: false};
  }
  const {title, location} = splitTitle(chosen.attempt.remainder, chosen.language);
  return {
    title,
    location,
    start: chosen.attempt.start,
    end: chosen.attempt.end,
    allDay: chosen.attempt.allDay,
    defaultDuration: chosen.attempt.defaultDuration,
  };
}
