import {describe, expect, it} from 'vitest';
import {dictionaryKeys, formatTag, resolveLocale, translate, translatePlural} from '../../src/i18n/strings';
import {shortDuration, startsIn} from '../../src/time/format';

describe('strings', () => {
  it('has every English key in Portuguese, with the same placeholders', () => {
    expect(dictionaryKeys('pt').sort()).toEqual(dictionaryKeys('en').sort());
    for (const key of dictionaryKeys('en')) {
      const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
      const typed = key as Parameters<typeof translate>[1];
      expect(placeholders(translate('pt', typed)), key).toEqual(placeholders(translate('en', typed)));
    }
  });

  it('picks Portuguese for any pt-* and English otherwise', () => {
    expect(resolveLocale(['pt-PT'])).toBe('pt');
    expect(resolveLocale(['fr-FR'])).toBe('en');
    expect(formatTag('en', 'en-GB')).toBe('en-GB');
    expect(formatTag('en', 'fr-FR')).toBe('en-US');
    expect(formatTag('pt', 'pt')).toBe('pt-BR');
  });

  it('counts with plural forms', () => {
    expect(translatePlural('en', 'guests', 1)).toBe('1 guest');
    expect(translatePlural('en', 'guests', 5)).toBe('5 guests');
    expect(translatePlural('pt', 'guests', 5)).toBe('5 convidados');
  });
});

describe('time', () => {
  it('says how soon an event starts', () => {
    const now = new Date(2026, 9, 9, 14, 35);
    expect(startsIn(new Date(2026, 9, 9, 15, 0), new Date(2026, 9, 9, 16, 0), now)).toBe('in 25 min');
    expect(startsIn(new Date(2026, 9, 9, 14, 0), new Date(2026, 9, 9, 15, 0), now)).toBe('now');
    expect(startsIn(new Date(2026, 9, 9, 13, 0), new Date(2026, 9, 9, 14, 0), now)).toBeNull();
    expect(startsIn(new Date(2026, 9, 10, 9, 0), new Date(2026, 9, 10, 10, 0), now)).toBeNull();
    expect(shortDuration(95, 'en')).toBe('1 h 35 min');
    expect(shortDuration(120, 'pt')).toBe('2 h');
  });
});
