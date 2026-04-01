'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BMSCity, BMSMovie, BMSFormat } from '@/lib/types';
import Calendar from '@/components/Calendar';

type Step = 'city' | 'movie' | 'format' | 'date' | 'confirm';

export default function AddTrackerPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('city');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Selections
  const [city, setCity] = useState<BMSCity | null>(null);
  const [movie, setMovie] = useState<BMSMovie | null>(null);
  const [format, setFormat] = useState<BMSFormat | null>(null);
  const [date, setDate] = useState('');

  // Search state
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<BMSCity[]>([]);
  const [movieQuery, setMovieQuery] = useState('');
  const [movieResults, setMovieResults] = useState<BMSMovie[]>([]);
  const [formats, setFormats] = useState<BMSFormat[]>([]);
  const [creating, setCreating] = useState(false);

  // ─── City Search ─────────────────────────────────────────────────

  async function searchCities() {
    if (!cityQuery.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/cities?q=${encodeURIComponent(cityQuery)}`);
      if (!res.ok) throw new Error('Failed to search cities');
      const data = await res.json();
      setCityResults(data);
      if (data.length === 0) setError('No cities found. Try a different name.');
    } catch {
      setError('Failed to search cities. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function selectCity(c: BMSCity) {
    setCity(c);
    setStep('movie');
    setMovieResults([]);
    setMovieQuery('');
    setError('');
  }

  // ─── Movie Search ────────────────────────────────────────────────

  async function searchMovies() {
    if (!city || !movieQuery.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/movies?citySlug=${city.regionSlug}&q=${encodeURIComponent(movieQuery)}`);
      if (!res.ok) throw new Error('Failed to search movies');
      const data = await res.json();
      setMovieResults(data);
      if (data.length === 0) setError('No movies found. Try a different search term.');
    } catch {
      setError('Failed to search movies. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function selectMovie(m: BMSMovie) {
    setMovie(m);
    setStep('format');
    setError('');
    fetchFormats(m);
  }

  // ─── Formats ─────────────────────────────────────────────────────

  async function fetchFormats(m: BMSMovie) {
    if (!city) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/formats?cityCode=${city.regionCode}&movieSlug=${m.slug}&eventCode=${m.eventCode}`
      );
      if (!res.ok) throw new Error('Failed to fetch formats');
      const data = await res.json();
      setFormats(data);
      if (data.length === 0) {
        setError('No formats found yet. Bookings may not have started — you can still track with the default format.');
      }
    } catch {
      setError('Failed to fetch formats. You can still proceed with default format.');
    } finally {
      setLoading(false);
    }
  }

  function selectFormat(f: BMSFormat) {
    setFormat(f);
    setStep('date');
    setError('');
  }

  function useDefaultFormat() {
    if (!movie) return;
    setFormat({ label: 'Any Format', eventCode: movie.eventCode });
    setStep('date');
    setError('');
  }

  // ─── Date ────────────────────────────────────────────────────────

  function confirmDate() {
    if (!date) {
      setError('Please select a date');
      return;
    }
    setError('');
    setStep('confirm');
  }

  // ─── Create Tracker ──────────────────────────────────────────────

  async function createTracker() {
    if (!city || !movie || !format || !date) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/trackers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movieTitle: movie.title,
          movieSlug: movie.slug,
          eventCode: movie.eventCode,
          formatEventCode: format.eventCode,
          formatLabel: format.label,
          cityCode: city.regionCode,
          cityName: city.regionName,
          date: date.replace(/-/g, ''),
        }),
      });
      if (!res.ok) throw new Error('Failed to create tracker');
      router.push('/');
    } catch {
      setError('Failed to create tracker. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  function goBack() {
    setError('');
    const stepOrder: Step[] = ['city', 'movie', 'format', 'date', 'confirm'];
    const idx = stepOrder.indexOf(step);
    if (idx > 0) setStep(stepOrder[idx - 1]);
  }

  function formatFriendlyDate(isoDate: string): string {
    return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  // ─── Render ──────────────────────────────────────────────────────

  const steps: { key: Step; label: string }[] = [
    { key: 'city', label: 'City' },
    { key: 'movie', label: 'Movie' },
    { key: 'format', label: 'Format' },
    { key: 'date', label: 'Date' },
    { key: 'confirm', label: 'Confirm' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Add Tracker</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <button
              onClick={() => i < currentStepIndex && setStep(s.key)}
              disabled={i >= currentStepIndex}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                i === currentStepIndex
                  ? 'bg-accent text-white'
                  : i < currentStepIndex
                    ? 'bg-accent/20 text-accent cursor-pointer hover:bg-accent/30'
                    : 'bg-card-border/30 text-muted'
              }`}
            >
              {s.label}
            </button>
            {i < steps.length - 1 && (
              <div className={`w-6 h-px ${i < currentStepIndex ? 'bg-accent' : 'bg-card-border'}`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red/10 border border-red/20 text-red text-sm">
          {error}
        </div>
      )}

      {/* Step: City */}
      {step === 'city' && (
        <div className="space-y-4">
          <p className="text-muted text-sm">Search for your city on BookMyShow</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchCities()}
              placeholder="e.g., Bengaluru, Mumbai, Delhi..."
              className="flex-1 px-4 py-2.5 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:border-accent"
              autoFocus
            />
            <button
              onClick={searchCities}
              disabled={loading}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
          {cityResults.length > 0 && (
            <div className="space-y-2">
              {cityResults.map((c) => (
                <button
                  key={c.regionCode}
                  onClick={() => selectCity(c)}
                  className="w-full text-left px-4 py-3 border border-card-border rounded-lg hover:border-accent transition-colors"
                >
                  <span className="font-medium">{c.regionName}</span>
                  <span className="text-muted text-sm ml-2">({c.regionCode})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step: Movie */}
      {step === 'movie' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="text-muted hover:text-foreground text-sm transition-colors">&larr; Back</button>
            <p className="text-muted text-sm">
              Search for a movie in <span className="text-foreground font-medium">{city?.regionName}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={movieQuery}
              onChange={(e) => setMovieQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchMovies()}
              placeholder="e.g., Avengers, Pushpa..."
              className="flex-1 px-4 py-2.5 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:border-accent"
              autoFocus
            />
            <button
              onClick={searchMovies}
              disabled={loading}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
          {movieResults.length > 0 && (
            <div className="space-y-2">
              {movieResults.map((m) => (
                <button
                  key={m.eventCode}
                  onClick={() => selectMovie(m)}
                  className="w-full text-left px-4 py-3 border border-card-border rounded-lg hover:border-accent transition-colors"
                >
                  <span className="font-medium">{m.title}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                    m.status === 'now_showing'
                      ? 'bg-green/20 text-green'
                      : 'bg-yellow/20 text-yellow'
                  }`}>
                    {m.status === 'now_showing' ? 'Now Showing' : 'Upcoming'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step: Format */}
      {step === 'format' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="text-muted hover:text-foreground text-sm transition-colors">&larr; Back</button>
            <p className="text-muted text-sm">
              Select a format for <span className="text-foreground font-medium">{movie?.title}</span>
            </p>
          </div>
          {loading ? (
            <div className="py-8 text-center text-muted text-sm">Loading formats from BookMyShow...</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {formats.map((f) => (
                  <button
                    key={f.eventCode}
                    onClick={() => selectFormat(f)}
                    className="px-4 py-2.5 border border-card-border rounded-lg text-sm hover:border-accent hover:text-accent transition-colors"
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button
                onClick={useDefaultFormat}
                className="text-sm text-accent hover:text-accent-hover transition-colors"
              >
                Track any format
              </button>
            </>
          )}
        </div>
      )}

      {/* Step: Date */}
      {step === 'date' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="text-muted hover:text-foreground text-sm transition-colors">&larr; Back</button>
            <p className="text-muted text-sm">
              When do you want to watch <span className="text-foreground font-medium">{movie?.title}</span>?
            </p>
          </div>
          <Calendar
            selected={date}
            onChange={(d) => setDate(d)}
            minDate={new Date().toISOString().slice(0, 10)}
          />
          <div>
            <button
              onClick={confirmDate}
              disabled={!date}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step: Confirm */}
      {step === 'confirm' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="text-muted hover:text-foreground text-sm transition-colors">&larr; Back</button>
            <p className="text-muted text-sm">Review and confirm</p>
          </div>
          <div className="border border-card-border rounded-lg bg-card p-5 space-y-3">
            <h3 className="font-semibold text-lg">Tracker Summary</h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-muted">Movie</span>
              <span>{movie?.title}</span>
              <span className="text-muted">City</span>
              <span>{city?.regionName}</span>
              <span className="text-muted">Format</span>
              <span>{format?.label}</span>
              <span className="text-muted">Date</span>
              <span>{date ? formatFriendlyDate(date) : ''}</span>
            </div>
          </div>
          <p className="text-sm text-muted">
            The tracker will check BookMyShow every ~2 minutes and email you when bookings open.
          </p>
          <div className="flex gap-3">
            <button
              onClick={createTracker}
              disabled={creating}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Start Tracking'}
            </button>
            <button
              onClick={() => setStep('city')}
              className="px-5 py-2.5 border border-card-border text-muted hover:text-foreground text-sm font-medium rounded-lg transition-colors"
            >
              Start Over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
