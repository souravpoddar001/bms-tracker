import type { ShowInfo } from './types';

const PVR_API = 'https://api3.pvrcinemas.com/api';

function pvrHeaders(city: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'chain': 'PVR',
    'city': city,
    'appVersion': '17.2',
    'platform': 'WEB',
  };
}

async function pvrPost(endpoint: string, city: string, body: Record<string, unknown> = {}): Promise<unknown> {
  const response = await fetch(`${PVR_API}/${endpoint}`, {
    method: 'POST',
    headers: pvrHeaders(city),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`PVR API ${response.status}: ${endpoint}`);
  }
  const data = await response.json() as { status: number; output: unknown; msg: string };
  if (!data.output) {
    throw new Error(`PVR API returned no data: ${data.msg}`);
  }
  return data.output;
}

// ─── Types for PVR API responses ───────────────────────────────────

interface PVRCityResponse {
  cc: { id: number; name: string };
  nb: PVRCityItem[];
  ot: PVRCityItem[];
}

interface PVRCityItem {
  id: number;
  name: string;
  region: string;
  cinemaCount: number;
  state: string;
}

interface PVRShowtimesResponse {
  days: Array<{ d: string; wd: string; dt: string; showDateStr: string; enable: boolean }>;
  showTimeSessions: PVRSession[];
}

interface PVRSession {
  cinemaRe: {
    theatreId: string;
    name: string;
    cityName: string;
    address1: string;
  };
  cinemaMovieSessions: PVRMovieSession[];
}

interface PVRMovieSession {
  movieRe: {
    filmName: string;
    films: Array<{
      filmId: string;
      filmCommonCode: string;
      filmCommonName: string;
      language: string;
      format: string;
    }>;
  };
  showCount: number;
  experienceSessions: Array<{
    experience?: string;
    shows: Array<{
      sessionId: number;
      showDate: string;
      showTime: string;
      endTime: string;
      totalSeats: number;
      availableSeats: number;
    }>;
  }>;
}

// ─── Public API ────────────────────────────────────────────────────

export interface CityResult {
  id: number;
  name: string;
  region: string;
  cinemaCount: number;
}

export async function fetchCities(): Promise<CityResult[]> {
  // Use a default city header — the city endpoint returns all cities regardless
  const output = await pvrPost('v1/booking/content/city', 'Mumbai', { lat: '0.000', lng: '0.000' }) as PVRCityResponse;
  const all = [...(output.nb || []), ...(output.ot || [])];
  return all.map((c) => ({
    id: c.id,
    name: c.name,
    region: c.region,
    cinemaCount: c.cinemaCount,
  }));
}

export interface MovieResult {
  filmCommonCode: string;
  filmName: string;
  languages: string[];
}

export async function searchMovies(city: string): Promise<MovieResult[]> {
  const output = await pvrPost('v1/booking/content/cshowtimes', city, {
    city, lat: '0.000', lng: '0.000', dated: 'NA', minDistance: 0,
  }) as PVRShowtimesResponse;

  // Collect unique movies across all cinemas
  const movieMap = new Map<string, MovieResult>();

  for (const session of output.showTimeSessions) {
    for (const cms of session.cinemaMovieSessions) {
      const films = cms.movieRe.films;
      if (!films || films.length === 0) continue;

      const commonCode = films[0].filmCommonCode;
      const commonName = films[0].filmCommonName || cms.movieRe.filmName;

      if (!movieMap.has(commonCode)) {
        movieMap.set(commonCode, {
          filmCommonCode: commonCode,
          filmName: commonName,
          languages: [],
        });
      }

      // Collect unique languages
      const movie = movieMap.get(commonCode)!;
      for (const film of films) {
        if (film.language && !movie.languages.includes(film.language)) {
          movie.languages.push(film.language);
        }
      }
    }
  }

  return Array.from(movieMap.values()).sort((a, b) => a.filmName.localeCompare(b.filmName));
}

export interface FormatResult {
  experience: string;
  label: string;
}

export async function fetchFormats(city: string, filmCommonCode: string): Promise<FormatResult[]> {
  const output = await pvrPost('v1/booking/content/cshowtimes', city, {
    city, lat: '0.000', lng: '0.000', dated: 'NA', minDistance: 0,
  }) as PVRShowtimesResponse;

  const experiences = new Set<string>();

  for (const session of output.showTimeSessions) {
    for (const cms of session.cinemaMovieSessions) {
      const matchesMovie = cms.movieRe.films?.some((f) => f.filmCommonCode === filmCommonCode);
      if (!matchesMovie) continue;

      for (const exp of cms.experienceSessions || []) {
        experiences.add(exp.experience || 'Standard');
      }
    }
  }

  return Array.from(experiences)
    .sort()
    .map((e) => ({ experience: e, label: e }));
}

export interface AvailabilityResult {
  available: boolean;
  shows: ShowInfo[];
  bookingUrl: string;
}

export async function checkAvailability(
  city: string,
  filmCommonCode: string,
  experience: string,
  date: string, // YYYYMMDD
): Promise<AvailabilityResult> {
  // Convert YYYYMMDD to YYYY-MM-DD for the dated param
  const dated = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;

  const output = await pvrPost('v1/booking/content/cshowtimes', city, {
    city, lat: '0.000', lng: '0.000', dated, minDistance: 0,
  }) as PVRShowtimesResponse;

  const shows: ShowInfo[] = [];
  const targetExperience = experience === 'Any' ? null : experience;

  for (const session of output.showTimeSessions) {
    for (const cms of session.cinemaMovieSessions) {
      const matchesMovie = cms.movieRe.films?.some((f) => f.filmCommonCode === filmCommonCode);
      if (!matchesMovie) continue;

      for (const exp of cms.experienceSessions || []) {
        const expName = exp.experience || 'Standard';
        if (targetExperience && expName !== targetExperience) continue;

        for (const show of exp.shows || []) {
          if (show.showDate !== dated) continue;
          shows.push({
            venue: session.cinemaRe.name,
            time: show.showTime,
            screenAttr: expName,
          });
        }
      }
    }
  }

  const bookingUrl = `https://www.pvrcinemas.com/show-timings`;

  return {
    available: shows.length > 0,
    shows,
    bookingUrl,
  };
}
