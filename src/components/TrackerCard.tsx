'use client';

import type { Tracker } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface TrackerCardProps {
  tracker: Tracker;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
}

const statusConfig = {
  polling: { label: 'Polling', color: 'bg-yellow/20 text-yellow', dot: 'bg-yellow' },
  found: { label: 'Bookings Open!', color: 'bg-green/20 text-green', dot: 'bg-green' },
  stopped: { label: 'Stopped', color: 'bg-muted/20 text-muted', dot: 'bg-muted' },
};

export default function TrackerCard({ tracker, onStop, onDelete }: TrackerCardProps) {
  const status = statusConfig[tracker.status];

  return (
    <div className="border border-card-border rounded-lg bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-lg font-semibold truncate">{tracker.movieTitle}</h3>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot} ${tracker.status === 'polling' ? 'animate-pulse' : ''}`} />
              {status.label}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted mt-2">
            <span>{tracker.experience}</span>
            {tracker.theatreName && <span>{tracker.theatreName}</span>}
            <span>{tracker.cityName}</span>
            <span>{formatDate(tracker.date)}</span>
          </div>

          {tracker.lastChecked && (
            <p className="text-xs text-muted mt-2">
              Last checked {formatDistanceToNow(new Date(tracker.lastChecked), { addSuffix: true })}
            </p>
          )}

          {tracker.lastError && tracker.status === 'polling' && (
            <p className="text-xs text-red mt-1">
              Error ({tracker.consecutiveErrors}x): {tracker.lastError.slice(0, 100)}
            </p>
          )}

          {tracker.status === 'found' && tracker.showsFound && tracker.showsFound.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-sm font-medium text-green">Available shows:</p>
              {tracker.showsFound.slice(0, 5).map((show, i) => (
                <p key={i} className="text-sm text-foreground/80 pl-3">
                  {show.venue} — {show.time} {show.screenAttr && `(${show.screenAttr})`}
                </p>
              ))}
              {tracker.showsFound.length > 5 && (
                <p className="text-xs text-muted pl-3">+{tracker.showsFound.length - 5} more</p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          {tracker.status === 'found' && tracker.bookingUrl && (
            <a
              href={tracker.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-sm font-medium bg-accent hover:bg-accent-hover text-white rounded-md transition-colors text-center"
            >
              Book Now
            </a>
          )}
          {tracker.status === 'polling' && (
            <button
              onClick={() => onStop(tracker.id)}
              className="px-3 py-1.5 text-sm font-medium border border-card-border hover:border-yellow text-muted hover:text-yellow rounded-md transition-colors"
            >
              Stop
            </button>
          )}
          <button
            onClick={() => onDelete(tracker.id)}
            className="px-3 py-1.5 text-sm font-medium border border-card-border hover:border-red text-muted hover:text-red rounded-md transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  return new Date(`${y}-${m}-${d}`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
