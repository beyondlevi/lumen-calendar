import type {CalEvent} from './google/types';

export function eventPath(event: Pick<CalEvent, 'calendarId' | 'id'>): string {
  return `/event/${encodeURIComponent(event.calendarId)}/${encodeURIComponent(event.id)}`;
}

export const REVIEW_PATH = '/review';
