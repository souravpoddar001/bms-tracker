export interface ShowInfo {
  venue: string;
  time: string;
  screenAttr: string;
}

// ─── Tracker (stored in Cosmos DB) ─────────────────────────────────

export interface Tracker {
  id: string;
  movieTitle: string;
  filmCommonCode: string;
  experience: string;       // "IMAX", "4DX", "Standard", "Any", etc.
  cityName: string;
  date: string;             // YYYYMMDD
  status: 'polling' | 'found' | 'stopped';
  lastChecked: string | null;
  lastError: string | null;
  consecutiveErrors: number;
  bookingUrl: string | null;
  showsFound: ShowInfo[] | null;
  createdAt: string;
  foundAt: string | null;
}

// ─── User Settings ─────────────────────────────────────────────────

export interface UserSettings {
  id: string;
  notificationEmails: string[];
  lastTestEmailSent: string | null;
}
