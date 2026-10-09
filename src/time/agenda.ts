import type {CalEvent} from '../google/types';

/**
 * The event of today the agenda opens on: the one going on now, else the next
 * one. Earlier events stay above it, later ones below. -1 when all are over.
 * `timed` is sorted by start.
 */
export function focusEventIndex(timed: readonly CalEvent[], current: Date): number {
  return timed.findIndex(event => event.end > current);
}
