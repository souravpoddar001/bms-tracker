'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Calendar from '@/components/Calendar';

type Step = 'city' | 'movie' | 'format' | 'date' | 'confirm';

interface City { id: number; name: string; region: string; cinemaCount: number }
interface Movie { filmCommonCode: string; filmName: string; languages: string[] }
interface Format { experience: string; label: string }

export default function AddTrackerPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('city');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [city, setCity] = useState<City | null>(null);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [format, setFormat] = useState<Format | null>(null);
  const [date, setDate] = useState('');

  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [movieQuery, setMovieQuery] = useState('');
  const [movieResults, setMovieResults] = useState<Movie[]>([]);
  const [formats, setFormats] = useState<Format[]>([]);
  const [creating, setCreating] = useState(false);

  async function searchCities() {
    if (!cityQuery.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/cities?q=${encodeURIComponent(cityQuery)}`);
      if (!res.ok) throw new Error('Failed to search cities');
      setCityResults(await res.json());
    } catch {
      setError('Failed to search cities.');
    } finally {
      setLoading(false);
    }
  }

  function selectCity(c: City) {
    setCity(c);
    setStep('movie');
    setMovieResults([]);
    setMovieQuery('');
    setError('');
  }

  async function searchMovies() {
    if (!city || !movieQuery.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/movies?city=${encodeURIComponent(city.name)}&q=${encodeURIComponent(movieQuery)}`);
      if (!res.ok) throw new Error('Failed to search movies');
      const data = await res.json();
      setMovieResults(data);
      if (data.length === 0) setError('No movies found.');
    } catch {
      setError('Failed to search movies.');
    } finally {
      setLoading(false);
    }
  }

  function selectMovie(m: Movie) {
    setMovie(m);
    setStep('format');
    setError('');
    fetchFormats(m);
  }

  async function fetchFormats(m: Movie) {
    if (!city) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/formats?city=${encodeURIComponent(city.name)}&filmCommonCode=${m.filmCommonCode}`);
      if (!res.ok) throw new Error('Failed to fetch formats');
      const data = await res.json();
      setFormats(data);
      if (data.length === 0) setError('No formats found. Showtimes may not be available yet.');
    } catch {
      setError('Failed to fetch formats.');
    } finally {
      setLoading(false);
    }
  }

  function selectFormat(f: Format) {
    setFormat(f);
    setStep('date');
    setError('');
  }

  function useAnyFormat() {
    setFormat({ experience: 'Any', label: 'Any Format' });
    setStep('date');
    setError('');
  }

  function confirmDate() {
    if (!date) { setError('Please select a date'); return; }
    setError('');
    setStep('confirm');
  }

  async function createTracker() {
    if (!city || !movie || !format || !date) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/trackers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movieTitle: movie.filmName,
          filmCommonCode: movie.filmCommonCode,
          experience: format.experience,
          cityName: city.name,
          date: date.replace(/-/g, ''),
        }),
      });
      if (!res.ok) throw new Error('Failed to create tracker');
      router.push('/');
    } catch {
      setError('Failed to create tracker.');
    } finally {
      setCreating(false);
    }
  }

  function goBack() {
    setError('');
    const stepOrder: Step[] = ['city', 'movie', 'format', 'date', 'confirm'];
    const idx = stepOrder.indexOf(step);
    if (idx > 0) setStep(stepOrder[idx - 1]);
  }

  function formatFriendlyDate(isoDate: string): string {
    return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

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
                i === currentStepIndex ? 'bg-accent text-white'
                  : i < currentStepIndex ? 'bg-accent/20 text-accent cursor-pointer hover:bg-accent/30'
                    : 'bg-card-border/30 text-muted'
              }`}
            >{s.label}</button>
            {i < steps.length - 1 && (
              <div className={`w-6 h-px ${i < currentStepIndex ? 'bg-accent' : 'bg-card-border'}`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red/10 border border-red/20 text-red text-sm">{error}</div>
      )}

      {/* City */}
      {step === 'city' && (
        <div className="space-y-4">
          <p className="text-muted text-sm">Search for your city</p>
          <div className="flex gap-2">
            <input type="text" value={cityQuery} onChange={(e) => setCityQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchCities()}
              placeholder="e.g., Bengaluru, Mumbai, Delhi..."
              className="flex-1 px-4 py-2.5 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:border-accent" autoFocus />
            <button onClick={searchCities} disabled={loading}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
          {cityResults.length > 0 && (
            <div className="space-y-2">
              {cityResults.map((c) => (
                <button key={c.id} onClick={() => selectCity(c)}
                  className="w-full text-left px-4 py-3 border border-card-border rounded-lg hover:border-accent transition-colors">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted text-sm ml-2">({c.cinemaCount} cinemas)</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Movie */}
      {step === 'movie' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="text-muted hover:text-foreground text-sm transition-colors">&larr; Back</button>
            <p className="text-muted text-sm">Search for a movie in <span className="text-foreground font-medium">{city?.name}</span></p>
          </div>
          <div className="flex gap-2">
            <input type="text" value={movieQuery} onChange={(e) => setMovieQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchMovies()}
              placeholder="e.g., Avengers, Pushpa..."
              className="flex-1 px-4 py-2.5 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:border-accent" autoFocus />
            <button onClick={searchMovies} disabled={loading}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
          {movieResults.length > 0 && (
            <div className="space-y-2">
              {movieResults.map((m) => (
                <button key={m.filmCommonCode} onClick={() => selectMovie(m)}
                  className="w-full text-left px-4 py-3 border border-card-border rounded-lg hover:border-accent transition-colors">
                  <span className="font-medium">{m.filmName}</span>
                  {m.languages.length > 0 && (
                    <span className="text-muted text-xs ml-2">{m.languages.join(', ')}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Format */}
      {step === 'format' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="text-muted hover:text-foreground text-sm transition-colors">&larr; Back</button>
            <p className="text-muted text-sm">Select a format for <span className="text-foreground font-medium">{movie?.filmName}</span></p>
          </div>
          {loading ? (
            <div className="py-8 text-center text-muted text-sm">Loading formats...</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {formats.map((f) => (
                  <button key={f.experience} onClick={() => selectFormat(f)}
                    className="px-4 py-2.5 border border-card-border rounded-lg text-sm hover:border-accent hover:text-accent transition-colors">
                    {f.label}
                  </button>
                ))}
              </div>
              <button onClick={useAnyFormat} className="text-sm text-accent hover:text-accent-hover transition-colors">
                Track any format
              </button>
            </>
          )}
        </div>
      )}

      {/* Date */}
      {step === 'date' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="text-muted hover:text-foreground text-sm transition-colors">&larr; Back</button>
            <p className="text-muted text-sm">When do you want to watch <span className="text-foreground font-medium">{movie?.filmName}</span>?</p>
          </div>
          <Calendar selected={date} onChange={(d) => setDate(d)} minDate={new Date().toISOString().slice(0, 10)} />
          <button onClick={confirmDate} disabled={!date}
            className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
            Next
          </button>
        </div>
      )}

      {/* Confirm */}
      {step === 'confirm' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="text-muted hover:text-foreground text-sm transition-colors">&larr; Back</button>
            <p className="text-muted text-sm">Review and confirm</p>
          </div>
          <div className="border border-card-border rounded-lg bg-card p-5 space-y-3">
            <h3 className="font-semibold text-lg">Tracker Summary</h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-muted">Movie</span><span>{movie?.filmName}</span>
              <span className="text-muted">City</span><span>{city?.name}</span>
              <span className="text-muted">Format</span><span>{format?.label}</span>
              <span className="text-muted">Date</span><span>{date ? formatFriendlyDate(date) : ''}</span>
            </div>
          </div>
          <p className="text-sm text-muted">
            The tracker will check PVR INOX every ~4 minutes and email you when bookings open.
          </p>
          <div className="flex gap-3">
            <button onClick={createTracker} disabled={creating}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
              {creating ? 'Creating...' : 'Start Tracking'}
            </button>
            <button onClick={() => setStep('city')}
              className="px-5 py-2.5 border border-card-border text-muted hover:text-foreground text-sm font-medium rounded-lg transition-colors">
              Start Over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
