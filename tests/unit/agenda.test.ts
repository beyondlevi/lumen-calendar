import {describe, expect, it} from 'vitest';
import type {CalEvent} from '../../src/google/types';
import {focusEventIndex} from '../../src/time/agenda';

describe('the event the agenda opens on', () => {
  const at = (hours: number, minutes = 0) => new Date(2026, 9, 9, hours, minutes);
  const event = (id: string, start: Date, end: Date) => ({id, start, end}) as CalEvent;
  const day = [
    event('team-sync', at(9), at(9, 30)),
    event('coffee', at(10, 30), at(11)),
    event('design-review', at(15), at(16)),
    event('call', at(16, 30), at(17)),
    event('gym', at(19), at(20)),
  ];
  const opened = (current: Date) => day[focusEventIndex(day, current)]?.id ?? null;

  it('is the one going on now, with earlier ones above and later ones below', () => {
    expect(opened(at(15, 20))).toBe('design-review');
    expect(focusEventIndex(day, at(15, 20))).toBe(2);
    expect(opened(at(16, 45))).toBe('call');
  });

  it('else the next one', () => {
    expect(opened(at(14, 35))).toBe('design-review');
    expect(opened(at(8))).toBe('team-sync');
    expect(opened(at(16, 0))).toBe('call');
  });

  it('is none once the day is over', () => {
    expect(focusEventIndex(day, at(21))).toBe(-1);
  });
});
