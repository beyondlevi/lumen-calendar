// Google Calendar API v3 shapes (only the fields the app reads) and the app's own model.

export type ResponseStatus = 'needsAction' | 'declined' | 'tentative' | 'accepted';

export type ApiCalendarListEntry = {
  id: string;
  summary?: string;
  summaryOverride?: string;
  backgroundColor?: string;
  accessRole?: 'freeBusyReader' | 'reader' | 'writer' | 'owner';
  primary?: boolean;
  selected?: boolean;
  hidden?: boolean;
  deleted?: boolean;
};

export type ApiCalendarList = {items?: ApiCalendarListEntry[]; nextPageToken?: string};

export type ApiEventDateTime = {date?: string; dateTime?: string; timeZone?: string};

export type ApiAttendee = {
  email?: string;
  displayName?: string;
  self?: boolean;
  organizer?: boolean;
  resource?: boolean;
  optional?: boolean;
  responseStatus?: ResponseStatus;
  [field: string]: unknown;
};

export type ApiEntryPoint = {entryPointType?: 'video' | 'phone' | 'sip' | 'more'; uri?: string; label?: string};

export type ApiEvent = {
  id: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  summary?: string;
  description?: string;
  location?: string;
  start?: ApiEventDateTime;
  end?: ApiEventDateTime;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: ApiEntryPoint[];
    conferenceSolution?: {name?: string};
  };
  attendees?: ApiAttendee[];
  attendeesOmitted?: boolean;
};

export type ApiEvents = {items?: ApiEvent[]; nextPageToken?: string};

/** A calendar of the account. */
export type Calendar = {
  id: string;
  name: string;
  /** `#rrggbb` from Google. */
  color: string;
  primary: boolean;
  /** Owner or writer: new events can go there. */
  writable: boolean;
  /** Google's own "show in the list" flag: the default before the wearer changes it here. */
  selected: boolean;
};

export type Meeting = {
  /** "Google Meet", "Zoom Meeting"… */
  kind: string;
  /** The join address, without the scheme, for display. */
  address: string | null;
};

export type Guests = {
  total: number;
  accepted: number;
  tentative: number;
  declined: number;
  needsAction: number;
};

export type CalEvent = {
  id: string;
  calendarId: string;
  calendarName: string;
  color: string;
  title: string;
  allDay: boolean;
  start: Date;
  /** Exclusive. */
  end: Date;
  location: string | null;
  meeting: Meeting | null;
  guests: Guests | null;
  /** The owner's answer when they are a guest; null when they aren't. */
  selfResponse: ResponseStatus | null;
  description: string | null;
  /** The attendee list as Google sent it, for replying with events.patch. */
  attendees: ApiAttendee[];
};

/** An event to create, from the Review screen. */
export type NewEvent = {
  title: string;
  location: string | null;
  start: Date;
  /** Exclusive. */
  end: Date;
  allDay: boolean;
};
