// ─── BMS Data Types ────────────────────────────────────────────────

export interface BMSCity {
  regionCode: string;    // e.g., "BANG"
  regionName: string;    // e.g., "Bengaluru"
  regionSlug: string;    // e.g., "bengaluru"
  alias: string[];       // e.g., ["Bangalore"]
}

export interface BMSMovie {
  eventCode: string;     // e.g., "ET00469257"
  title: string;
  slug: string;          // URL-friendly name
  status: 'now_showing' | 'upcoming';
}

export interface BMSFormat {
  label: string;         // e.g., "English - IMAX 3D"
  eventCode: string;     // Format-specific event code
}

export interface ShowInfo {
  venue: string;
  time: string;
  screenAttr: string;
}

// ─── Tracker (stored in Cosmos DB) ─────────────────────────────────

export interface Tracker {
  id: string;
  movieTitle: string;
  movieSlug: string;
  eventCode: string;
  formatEventCode: string;
  formatLabel: string;
  cityCode: string;
  cityName: string;
  date: string;            // YYYYMMDD
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
