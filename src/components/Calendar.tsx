'use client';

import { useState } from 'react';

interface CalendarProps {
  selected: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  minDate?: string; // YYYY-MM-DD
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function Calendar({ selected, onChange, minDate }: CalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const initial = selected ? new Date(selected + 'T00:00:00') : today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const min = minDate ? new Date(minDate + 'T00:00:00') : today;

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  }

  // Build grid of days
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: Array<{ day: number; dateStr: string; disabled: boolean; isToday: boolean; isSelected: boolean } | null> = [];

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) cells.push(null);

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(viewYear, viewMonth, d);
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({
      day: d,
      dateStr,
      disabled: date < min,
      isToday: date.getTime() === today.getTime(),
      isSelected: dateStr === selected,
    });
  }

  // Can we go back?
  const canGoPrev = new Date(viewYear, viewMonth, 0) >= min;

  return (
    <div className="inline-block bg-card border border-card-border rounded-xl p-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          disabled={!canGoPrev}
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-card-border/50 text-muted hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          &larr;
        </button>
        <span className="text-sm font-semibold">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-card-border/50 text-muted hover:text-foreground transition-colors"
        >
          &rarr;
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs text-muted font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) =>
          cell === null ? (
            <div key={`empty-${i}`} />
          ) : (
            <button
              key={cell.dateStr}
              onClick={() => !cell.disabled && onChange(cell.dateStr)}
              disabled={cell.disabled}
              className={`
                w-9 h-9 rounded-lg text-sm font-medium transition-colors
                ${cell.isSelected
                  ? 'bg-accent text-white'
                  : cell.isToday
                    ? 'bg-accent/20 text-accent hover:bg-accent/30'
                    : cell.disabled
                      ? 'text-muted/30 cursor-not-allowed'
                      : 'text-foreground hover:bg-card-border/50'
                }
              `}
            >
              {cell.day}
            </button>
          )
        )}
      </div>

      {/* Selected date display */}
      {selected && (
        <div className="mt-3 pt-3 border-t border-card-border/50 text-center text-sm text-muted">
          {new Date(selected + 'T00:00:00').toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </div>
      )}
    </div>
  );
}
