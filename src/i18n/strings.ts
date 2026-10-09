// Every user-facing string lives in this file. English is the default and the
// fallback; Portuguese (pt-BR copy) is chosen for any `pt-*` language. Counted
// strings have `_one` and `_other` forms; dates and times go through Intl
// (src/time/format.ts).

const en = {
  appName: 'Calendar',

  tabToday: 'Today',
  tabWeek: 'Week',
  tabNew: 'New',
  tabCalendars: 'Calendars',
  sectionsLabel: 'Calendar sections',
  todayLabel: "Today's events",
  weekLabel: 'The next 7 days',
  calendarsLabel: 'Your calendars',

  allDay: 'All day',
  noTitle: '(No title)',
  now: 'now',
  inTime: 'in {time}',
  minutesShort_one: '{count} min',
  minutesShort_other: '{count} min',
  hoursShort_one: '{count} h',
  hoursShort_other: '{count} h',
  hoursMinutesShort: '{hours} h {minutes} min',
  pair: '{first} · {second}',
  timeRange: '{start} – {end}',
  today: 'Today',
  tomorrow: 'Tomorrow',
  todayWithDate: 'Today, {date}',
  tomorrowWithDate: 'Tomorrow, {date}',
  eventLabel: '{title}, {time}, {calendar}',
  eventLabelNext: '{title}, {time}, {calendar}, {relative}',

  emptyTodayTitle: 'Nothing on today',
  emptyTodayBody: 'No events today in the calendars you show.',
  emptyTodayRestTitle: 'No more events today',
  emptyWeekTitle: 'A free week',
  emptyWeekBody: 'No events in the next 7 days in the calendars you show.',
  emptyCalendarsTitle: 'No calendars',
  emptyCalendarsBody: 'This Google account has no calendars.',
  emptyLabel: 'Nothing to show',
  newEventAction: 'New event',

  loadingHeader: 'Loading…',
  loadingLabel: 'Loading',
  connecting: 'Connecting…',
  retry: 'Try again',
  errorLabel: 'Error',
  errNetworkTitle: "Can't reach Google",
  errNetworkBody: 'Check the internet connection and try again.',
  errServerTitle: 'Google Calendar is not answering',
  errServerBody: 'Try again in a moment.',
  errRateTitle: 'Too many requests',
  errRateBody: 'Google asked the app to slow down. Try again in a minute.',
  errForbiddenTitle: 'Not allowed',
  errForbiddenBody: 'Google did not allow this. The account may not have access to this calendar.',
  errNotFoundTitle: 'Not found',
  errNotFoundBody: 'Google could not find it. It may have been deleted.',
  httpStatus: 'HTTP {status}',
  reasonNetwork: 'no connection',
  reasonServer: 'Google error',
  reasonRate: 'too many requests',
  reasonForbidden: 'not allowed',
  reasonNotFound: 'not found',
  reasonAuth: 'access refused',

  eventDetailsLabel: 'Event details',
  guests_one: '{count} guest',
  guests_other: '{count} guests',
  guestsGoing: '{count} going',
  guestsMaybe: '{count} maybe',
  guestsDeclined: '{count} declined',
  guestsWaiting: '{count} awaiting',
  videoCall: 'Video call',
  replyGoing: 'Going',
  replyMaybe: 'Maybe',
  replyNo: 'No',
  replyNoLabel: 'Not going',
  repliedGoing: "You're going",
  repliedMaybe: 'You might go',
  repliedNo: "You're not going",
  replyFailed: 'Reply not sent: {reason}',
  eventMissingTitle: 'Event not found',
  eventMissingBody: 'It may have been deleted or moved to a hidden calendar.',

  writeHint: 'What, when and where',
  writeExample: '“Lunch with Ana tomorrow at 1 pm at Coco Bambu”',
  writeFieldLabel: 'New event: what, when and where',
  writeLabel: 'New event',
  continue: 'Continue',
  hintIndexTap: 'Index tap: dictate or write with the band',
  hintMiddleTap: 'Middle tap: back',

  reviewHeader: 'New event',
  reviewMetadata: 'Check it',
  reviewLabel: 'Event to save',
  reviewCardLabel: '{title}. {when}. Calendar: {calendar}. Select to switch to the next calendar.',
  defaultDuration: 'One hour, unless you say how long',
  noDateTitle: 'No date or time found',
  noDateBody: 'Edit the text and say when, like “tomorrow at 3 pm”.',
  save: 'Save',
  edit: 'Edit',
  discard: 'Discard',
  savedTo: 'Saved to {calendar}',
  saveFailed: 'Not saved: {reason}',

  newEventsGoHere: 'New events go here',
  calendarShown: 'Shown',

  setupTitle: 'Connect Google Calendar',
  setupStep1: 'On your phone, open Lumen › Apps › Calendar.',
  setupStep2: 'Fill in the client ID, the secret and the refresh token.',
  setupStep3: 'Come back here: your day shows up.',
  setupNote: "The app's README shows how to get them, once, on a computer.",
  setupRefused: 'Google refused the saved refresh token. Make a new one with the README’s script and paste it on your phone.',
  setupStepsLabel: 'Steps',
  setupLabel: 'Connect Google Calendar',
  stillNotConnected: 'Still not connected',
};

export type StringKey = keyof typeof en;
type Strings = Record<StringKey, string>;

const pt: Strings = {
  appName: 'Agenda',

  tabToday: 'Hoje',
  tabWeek: 'Semana',
  tabNew: 'Novo',
  tabCalendars: 'Agendas',
  sectionsLabel: 'Seções da agenda',
  todayLabel: 'Eventos de hoje',
  weekLabel: 'Os próximos 7 dias',
  calendarsLabel: 'Suas agendas',

  allDay: 'Dia todo',
  noTitle: '(Sem título)',
  now: 'agora',
  inTime: 'em {time}',
  minutesShort_one: '{count} min',
  minutesShort_other: '{count} min',
  hoursShort_one: '{count} h',
  hoursShort_other: '{count} h',
  hoursMinutesShort: '{hours} h {minutes} min',
  pair: '{first} · {second}',
  timeRange: '{start} – {end}',
  today: 'Hoje',
  tomorrow: 'Amanhã',
  todayWithDate: 'Hoje, {date}',
  tomorrowWithDate: 'Amanhã, {date}',
  eventLabel: '{title}, {time}, {calendar}',
  eventLabelNext: '{title}, {time}, {calendar}, {relative}',

  emptyTodayTitle: 'Nada para hoje',
  emptyTodayBody: 'Nenhum evento hoje nas agendas que você mostra.',
  emptyTodayRestTitle: 'Mais nenhum evento hoje',
  emptyWeekTitle: 'Semana livre',
  emptyWeekBody: 'Nenhum evento nos próximos 7 dias nas agendas que você mostra.',
  emptyCalendarsTitle: 'Nenhuma agenda',
  emptyCalendarsBody: 'Esta conta do Google não tem agendas.',
  emptyLabel: 'Nada para mostrar',
  newEventAction: 'Novo evento',

  loadingHeader: 'Carregando…',
  loadingLabel: 'Carregando',
  connecting: 'Conectando…',
  retry: 'Tentar de novo',
  errorLabel: 'Erro',
  errNetworkTitle: 'Sem acesso ao Google',
  errNetworkBody: 'Verifique a internet e tente de novo.',
  errServerTitle: 'O Google Agenda não está respondendo',
  errServerBody: 'Tente de novo daqui a pouco.',
  errRateTitle: 'Pedidos demais',
  errRateBody: 'O Google pediu para o app ir mais devagar. Tente de novo daqui a um minuto.',
  errForbiddenTitle: 'Não permitido',
  errForbiddenBody: 'O Google não permitiu. A conta pode não ter acesso a esta agenda.',
  errNotFoundTitle: 'Não encontrado',
  errNotFoundBody: 'O Google não encontrou. Pode ter sido apagado.',
  httpStatus: 'HTTP {status}',
  reasonNetwork: 'sem conexão',
  reasonServer: 'erro do Google',
  reasonRate: 'pedidos demais',
  reasonForbidden: 'não permitido',
  reasonNotFound: 'não encontrado',
  reasonAuth: 'acesso recusado',

  eventDetailsLabel: 'Detalhes do evento',
  guests_one: '{count} convidado',
  guests_other: '{count} convidados',
  guestsGoing: '{count} vão',
  guestsMaybe: '{count} talvez',
  guestsDeclined: '{count} não vão',
  guestsWaiting: '{count} sem resposta',
  videoCall: 'Videochamada',
  replyGoing: 'Vou',
  replyMaybe: 'Talvez',
  replyNo: 'Não',
  replyNoLabel: 'Não vou',
  repliedGoing: 'Você vai',
  repliedMaybe: 'Você talvez vá',
  repliedNo: 'Você não vai',
  replyFailed: 'Resposta não enviada: {reason}',
  eventMissingTitle: 'Evento não encontrado',
  eventMissingBody: 'Ele pode ter sido apagado ou movido para uma agenda oculta.',

  writeHint: 'O quê, quando e onde',
  writeExample: '“Almoço com a Ana amanhã às 13h no Coco Bambu”',
  writeFieldLabel: 'Novo evento: o quê, quando e onde',
  writeLabel: 'Novo evento',
  continue: 'Continuar',
  hintIndexTap: 'Toque do indicador: dite ou escreva com a band',
  hintMiddleTap: 'Toque do médio: voltar',

  reviewHeader: 'Novo evento',
  reviewMetadata: 'Confira',
  reviewLabel: 'Evento a salvar',
  reviewCardLabel: '{title}. {when}. Agenda: {calendar}. Selecione para trocar para a próxima agenda.',
  defaultDuration: 'Uma hora, a não ser que você diga quanto',
  noDateTitle: 'Nenhuma data ou hora encontrada',
  noDateBody: 'Edite o texto e diga quando, como “amanhã às 15h”.',
  save: 'Salvar',
  edit: 'Editar',
  discard: 'Descartar',
  savedTo: 'Salvo em {calendar}',
  saveFailed: 'Não salvo: {reason}',

  newEventsGoHere: 'Novos eventos vão para cá',
  calendarShown: 'Mostrada',

  setupTitle: 'Conecte o Google Agenda',
  setupStep1: 'No celular, abra Lumen › Apps › Calendar.',
  setupStep2: 'Preencha o ID do cliente, o segredo e o refresh token.',
  setupStep3: 'Volte aqui: seu dia aparece.',
  setupNote: 'O README do app mostra como obtê-los, uma vez, num computador.',
  setupRefused: 'O Google recusou o refresh token salvo. Gere um novo com o script do README e cole no celular.',
  setupStepsLabel: 'Passos',
  setupLabel: 'Conecte o Google Agenda',
  stillNotConnected: 'Ainda não conectado',
};

const dictionaries = {en, pt} satisfies Record<string, Strings>;
export type Locale = keyof typeof dictionaries;

/** Picks the dictionary from the base language (`pt-PT` and `pt-BR` both map to `pt`). */
export function resolveLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0];
    if (base in dictionaries) {
      return base as Locale;
    }
  }
  return 'en';
}

function browserLanguage(): string {
  return typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';
}

export const locale: Locale = resolveLocale([browserLanguage()]);

/**
 * The BCP 47 tag for Intl: the device's own tag when it is in the language the
 * app shows (so `en-GB` keeps its 24-hour clock), else that language's default.
 */
export function formatTag(target: Locale = locale, language: string = browserLanguage()): string {
  return resolveLocale([language]) === target && language.includes('-') ? language : target === 'pt' ? 'pt-BR' : 'en-US';
}

type Params = Record<string, string | number>;

function fill(template: string, params?: Params): string {
  if (params == null) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function translate(target: Locale, key: StringKey, params?: Params): string {
  return fill(dictionaries[target][key], params);
}

export function t(key: StringKey, params?: Params): string {
  return translate(locale, key, params);
}

/** Keys that have `_one`/`_other` forms, without the suffix. */
export type PluralKey = {
  [K in StringKey]: K extends `${infer Base}_one` ? (`${Base}_other` extends StringKey ? Base : never) : never;
}[StringKey];

export function translatePlural(target: Locale, key: PluralKey, count: number, params?: Params): string {
  const form = new Intl.PluralRules(target).select(count) === 'one' ? 'one' : 'other';
  return translate(target, `${key}_${form}` as StringKey, {count, ...params});
}

/** A counted string: `tp('guests', 5)` → "5 guests". */
export function tp(key: PluralKey, count: number, params?: Params): string {
  return translatePlural(locale, key, count, params);
}

export function dictionaryKeys(target: Locale): string[] {
  return Object.keys(dictionaries[target]);
}
