import {describe, expect, it} from 'vitest';
import {parseEventText} from '../../src/parse/eventText';

// Friday, 9 October 2026, 14:35 local time.
const NOW = new Date(2026, 9, 9, 14, 35);
const at = (day: number, hours: number, minutes = 0) => new Date(2026, 9, day, hours, minutes);

describe('parseEventText in English', () => {
  it('reads the title, the date, the time and the place', () => {
    expect(parseEventText('Lunch with Ana tomorrow at 1 pm at Coco Bambu', 'en', NOW)).toEqual({
      title: 'Lunch with Ana',
      location: 'Coco Bambu',
      start: at(10, 13),
      end: at(10, 14),
      allDay: false,
      defaultDuration: true,
    });
  });

  it('takes a duration said with "for"', () => {
    const parsed = parseEventText('Dentist on Monday at 9:30 for 2 hours', 'en', NOW);
    expect(parsed).toMatchObject({title: 'Dentist', location: null, start: at(12, 9, 30), end: at(12, 11, 30), defaultDuration: false});
    expect(parseEventText('Standup tomorrow 9am for 15 minutes', 'en', NOW)).toMatchObject({title: 'Standup', end: at(10, 9, 15)});
    expect(parseEventText('Review today at 4pm for an hour and 30 minutes', 'en', NOW)).toMatchObject({start: at(9, 16), end: at(9, 17, 30)});
  });

  it('takes a time range', () => {
    expect(parseEventText('Meeting with Bob next Friday from 3 to 5pm at the office', 'en', NOW)).toMatchObject({
      title: 'Meeting with Bob',
      location: 'the office',
      start: at(16, 15),
      end: at(16, 17),
      defaultDuration: false,
    });
  });

  it('makes a date without a time an all-day event', () => {
    expect(parseEventText('Trip to Ubatuba on Saturday', 'en', NOW)).toMatchObject({
      title: 'Trip to Ubatuba',
      start: at(10, 0),
      end: at(11, 0),
      allDay: true,
      defaultDuration: false,
    });
    expect(parseEventText('Trip from Oct 10 to Oct 12', 'en', NOW)).toMatchObject({title: 'Trip', start: at(10, 0), end: at(13, 0), allDay: true});
  });

  it('places a time alone today', () => {
    expect(parseEventText('Call mom at 6pm', 'en', NOW)).toMatchObject({title: 'Call mom', start: at(9, 18), end: at(9, 19)});
  });

  it('says when there is no date or time', () => {
    expect(parseEventText('Buy milk', 'en', NOW)).toEqual({
      title: 'Buy milk',
      location: null,
      start: null,
      end: null,
      allDay: false,
      defaultDuration: false,
    });
  });
});

describe('parseEventText in Portuguese', () => {
  it('reads spoken times such as 13h and the place after no/na/em', () => {
    expect(parseEventText('Almoço com a Ana amanhã às 13h no Coco Bambu', 'pt', NOW)).toEqual({
      title: 'Almoço com a Ana',
      location: 'Coco Bambu',
      start: at(10, 13),
      end: at(10, 14),
      allDay: false,
      defaultDuration: true,
    });
    expect(parseEventText('Jantar dia 20 de outubro às 20h em Pinheiros', 'pt', NOW)).toMatchObject({
      title: 'Jantar',
      location: 'Pinheiros',
      start: at(20, 20),
    });
    expect(parseEventText('Café amanhã às 10h30', 'pt', NOW)).toMatchObject({title: 'Café', start: at(10, 10, 30)});
  });

  it('takes a duration said with "por"', () => {
    expect(parseEventText('Dentista segunda às 9:30 por 2 horas', 'pt', NOW)).toMatchObject({
      title: 'Dentista',
      start: at(12, 9, 30),
      end: at(12, 11, 30),
      defaultDuration: false,
    });
    expect(parseEventText('Reunião amanhã ao meio-dia por 1 hora e meia', 'pt', NOW)).toMatchObject({
      title: 'Reunião',
      start: at(10, 12),
      end: at(10, 13, 30),
    });
    expect(parseEventText('Academia amanhã às 7 da manhã por uma hora', 'pt', NOW)).toMatchObject({
      title: 'Academia',
      start: at(10, 7),
      end: at(10, 8),
    });
  });

  it('reads "das 15h às 17h" as a range and "3 da tarde" as 15:00', () => {
    expect(parseEventText('Reunião sexta-feira das 15h às 17h na sala 3', 'pt', NOW)).toMatchObject({
      title: 'Reunião',
      location: 'sala 3',
      start: at(9, 15),
      end: at(9, 17),
    });
    expect(parseEventText('Consulta amanhã às 3 da tarde', 'pt', NOW)).toMatchObject({start: at(10, 15)});
  });

  it('makes a date without a time an all-day event', () => {
    expect(parseEventText('Viagem para Ubatuba no sábado', 'pt', NOW)).toMatchObject({
      title: 'Viagem para Ubatuba',
      location: null,
      start: at(10, 0),
      end: at(11, 0),
      allDay: true,
    });
    expect(parseEventText('Viagem de 10 a 12 de outubro', 'pt', NOW)).toMatchObject({title: 'Viagem', start: at(10, 0), end: at(13, 0), allDay: true});
  });

  it('understands English dictated while the app is in Portuguese', () => {
    expect(parseEventText('Lunch with Ana tomorrow at 1 pm at Coco Bambu', 'pt', NOW)).toMatchObject({
      title: 'Lunch with Ana',
      location: 'Coco Bambu',
      start: at(10, 13),
    });
  });

  it('says when there is no date or time', () => {
    expect(parseEventText('Comprar pão', 'pt', NOW)).toMatchObject({title: 'Comprar pão', start: null, end: null});
  });
});
