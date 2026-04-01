import { execFile } from 'child_process';
import { promisify } from 'util';
import type { BMSCity, BMSMovie, BMSFormat, ShowInfo } from './types';

const execFileAsync = promisify(execFile);

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const REGIONS_API = 'https://in.bookmyshow.com/api/explore/v1/discover/regions';

// ─── HTTP Layer (curl to bypass Cloudflare) ────────────────────────

async function fetchBMS(url: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      'curl',
      ['-s', '--http1.1', '-L', '-H', `User-Agent: ${USER_AGENT}`, url],
      { timeout: 30_000, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    return stdout;
  } catch (error) {
    throw new Error(`Failed to fetch ${url}: ${error}`);
  }
}

async function fetchJSON(url: string): Promise<unknown> {
  const text = await fetchBMS(url);
  return JSON.parse(text);
}

function extractInitialState(html: string): Record<string, unknown> {
  const marker = 'window.__INITIAL_STATE__';
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) {
    throw new Error('Could not find __INITIAL_STATE__ in page HTML');
  }

  // Find the opening brace after the marker
  const jsonStart = html.indexOf('{', markerIdx);
  if (jsonStart === -1) {
    throw new Error('Could not find JSON start in __INITIAL_STATE__');
  }

  // Use balanced-brace counting to find the matching closing brace
  let depth = 0;
  let jsonEnd = -1;
  for (let i = jsonStart; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) { jsonEnd = i; break; }
    }
  }

  if (jsonEnd === -1) {
    throw new Error('Could not find matching closing brace for __INITIAL_STATE__');
  }

  return JSON.parse(html.slice(jsonStart, jsonEnd + 1));
}

function buildBuyTicketsUrl(movieSlug: string, cityCode: string, eventCode: string, date: string): string {
  return `https://in.bookmyshow.com/buytickets/${movieSlug}/movie-${cityCode.toLowerCase()}-${eventCode}-MT/${date}`;
}

// ─── Cities ────────────────────────────────────────────────────────

export async function fetchCities(): Promise<BMSCity[]> {
  const data = await fetchJSON(REGIONS_API) as {
    BookMyShow: {
      TopCities: Array<{ RegionCode: string; RegionName: string; RegionSlug: string; Alias: string[] }>;
      OtherCities: Array<{ RegionCode: string; RegionName: string; RegionSlug: string; Alias: string[] }>;
    };
  };

  const all = [...(data.BookMyShow.TopCities || []), ...(data.BookMyShow.OtherCities || [])];
  return all.map((c) => ({
    regionCode: c.RegionCode,
    regionName: c.RegionName,
    regionSlug: c.RegionSlug,
    alias: c.Alias || [],
  }));
}

// ─── Movies ────────────────────────────────────────────────────────

export async function searchMovies(citySlug: string): Promise<BMSMovie[]> {
  const movies: BMSMovie[] = [];

  // Fetch now-showing and upcoming in parallel
  const [nowShowingResult, upcomingResult] = await Promise.allSettled([
    fetchAndParseMovies(`https://in.bookmyshow.com/explore/movies-${citySlug}`, 'now_showing'),
    fetchAndParseMovies(`https://in.bookmyshow.com/explore/upcoming-movies-${citySlug}`, 'upcoming'),
  ]);

  if (nowShowingResult.status === 'fulfilled') movies.push(...nowShowingResult.value);
  else console.error('[BMS] Failed to fetch now-showing movies:', nowShowingResult.reason);

  if (upcomingResult.status === 'fulfilled') movies.push(...upcomingResult.value);
  else console.error('[BMS] Failed to fetch upcoming movies:', upcomingResult.reason);

  // Deduplicate by eventCode
  const seen = new Set<string>();
  return movies.filter((m) => {
    if (seen.has(m.eventCode)) return false;
    seen.add(m.eventCode);
    return true;
  });
}

async function fetchAndParseMovies(
  url: string,
  status: 'now_showing' | 'upcoming'
): Promise<BMSMovie[]> {
  const html = await fetchBMS(url);
  const state = extractInitialState(html);
  const explore = (state as Record<string, unknown>).explore as Record<string, unknown> | undefined;

  const section = status === 'now_showing'
    ? (explore?.movies as Record<string, unknown>)
    : (explore?.other as Record<string, unknown>);

  const listings = section?.listings as Array<Record<string, unknown>> | undefined;
  if (!listings) return [];

  const movies: BMSMovie[] = [];
  for (const listing of listings) {
    const cards = listing.cards as Array<Record<string, unknown>> | undefined;
    if (!cards) continue;
    for (const card of cards) {
      const analytics = card.analytics as Record<string, string> | undefined;
      const ctaUrl = (card.ctaUrl as string) || '';
      if (!analytics?.event_code) continue;

      const slugMatch = ctaUrl.match(/\/movies\/[^/]+\/([^/]+)/);
      movies.push({
        eventCode: analytics.event_code,
        title: analytics.title || 'Unknown',
        slug: slugMatch ? slugMatch[1] : '',
        status,
      });
    }
  }
  return movies;
}

// ─── Formats ───────────────────────────────────────────────────────

export async function fetchFormats(
  cityCode: string,
  movieSlug: string,
  eventCode: string
): Promise<BMSFormat[]> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const url = buildBuyTicketsUrl(movieSlug, cityCode, eventCode, today);

  try {
    const html = await fetchBMS(url);
    const state = extractInitialState(html);
    const showtimes = (state as Record<string, unknown>).showtimesByEvent as Record<string, unknown> | undefined;
    if (!showtimes) return [];

    const showDates = showtimes.showDates as Record<string, unknown> | undefined;
    if (!showDates || Object.keys(showDates).length === 0) {
      return extractFormatsFromEventData(state);
    }

    const firstDateKey = Object.keys(showDates)[0];
    const dateData = showDates[firstDateKey] as Record<string, unknown>;
    const dynamic = dateData?.dynamic as Record<string, unknown>;
    const leftStickyWidgets = dynamic?.leftStickyWidgets as Array<Record<string, unknown>> | undefined;

    if (!leftStickyWidgets) return [];

    // Find the "Format & Language" widget — its text is on the outer widget,
    // and the format chips are in widget.data.widgets[]
    for (const widget of leftStickyWidgets) {
      if (!(widget.text as string)?.includes('Format')) continue;

      const widgetData = widget.data as Record<string, unknown> | undefined;
      const chips = widgetData?.widgets as Array<Record<string, unknown>> | undefined;
      if (!chips) continue;

      return chips.map((chip) => {
        const cta = chip.cta as Record<string, unknown> | undefined;
        const additionalData = cta?.additionalData as Record<string, string> | undefined;
        return {
          label: (chip.title as string) || 'Unknown',
          eventCode: additionalData?.eventCode || eventCode,
        };
      });
    }
  } catch (error) {
    console.error('[BMS] Failed to fetch formats:', error);
  }

  return [];
}

function extractFormatsFromEventData(state: Record<string, unknown>): BMSFormat[] {
  try {
    const showtimes = state.showtimesByEvent as Record<string, unknown>;
    const sharedData = showtimes?.sharedData as Record<string, unknown>;
    const eventData = sharedData?.selectChildEventData as Record<string, unknown>;

    if (!eventData) return [];

    // selectChildEventData can be a single object (not an array)
    const lang = (eventData.eventLanguage as string) || 'Unknown';
    const dim = (eventData.eventDimension as string) || '2D';
    const code = (eventData.eventCode as string) || '';

    if (!code) return [];
    return [{ label: `${lang} - ${dim}`, eventCode: code }];
  } catch {
    return [];
  }
}

// ─── Availability Check ────────────────────────────────────────────

export interface AvailabilityResult {
  available: boolean;
  shows: ShowInfo[];
  bookingUrl: string;
}

export async function checkAvailability(
  cityCode: string,
  movieSlug: string,
  formatEventCode: string,
  date: string
): Promise<AvailabilityResult> {
  const url = buildBuyTicketsUrl(movieSlug, cityCode, formatEventCode, date);

  const html = await fetchBMS(url);
  const state = extractInitialState(html);
  const showtimes = (state as Record<string, unknown>).showtimesByEvent as Record<string, unknown> | undefined;

  if (!showtimes) {
    return { available: false, shows: [], bookingUrl: url };
  }

  const showDates = showtimes.showDates as Record<string, unknown> | undefined;
  if (!showDates || Object.keys(showDates).length === 0) {
    return { available: false, shows: [], bookingUrl: url };
  }

  const shows: ShowInfo[] = [];
  const targetDateData = (showDates[date] || Object.values(showDates)[0]) as Record<string, unknown> | undefined;

  if (!targetDateData) {
    return { available: false, shows: [], bookingUrl: url };
  }

  const dynamic = targetDateData.dynamic as Record<string, unknown> | undefined;
  const data = dynamic?.data as Record<string, unknown> | undefined;
  const showtimeWidgets = data?.showtimeWidgets as Array<Record<string, unknown>> | undefined;

  if (!showtimeWidgets) {
    return { available: false, shows: [], bookingUrl: url };
  }

  for (const widget of showtimeWidgets) {
    if (widget.type !== 'groupList') continue;
    const groups = widget.data as Array<Record<string, unknown>> | undefined;
    if (!groups) continue;

    for (const group of groups) {
      const groupData = group.data as Array<Record<string, unknown>> | undefined;
      if (!groupData) continue;

      for (const venueCard of groupData) {
        if (venueCard.type !== 'venue-card') continue;
        const additionalData = venueCard.additionalData as Record<string, string> | undefined;
        const venueName = additionalData?.venueName || 'Unknown Venue';
        const venueShowtimes = venueCard.showtimes as Array<Record<string, unknown>> | undefined;

        if (!venueShowtimes) continue;
        for (const st of venueShowtimes) {
          shows.push({
            venue: venueName,
            time: (st.title as string) || '',
            screenAttr: (st.screenAttr as string) || '',
          });
        }
      }
    }
  }

  return {
    available: shows.length > 0,
    shows,
    bookingUrl: url,
  };
}
