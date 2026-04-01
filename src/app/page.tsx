'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { Tracker } from '@/lib/types';
import TrackerCard from '@/components/TrackerCard';

export default function Dashboard() {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [maskedEmails, setMaskedEmails] = useState<string[]>([]);
  const [lastTestEmailSent, setLastTestEmailSent] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [adding, setAdding] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error' | 'rate_limited'>('idle');
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<NodeJS.Timeout>(null);

  const fetchTrackers = useCallback(async () => {
    try {
      const res = await fetch('/api/trackers');
      if (res.ok) setTrackers(await res.json());
    } catch (error) {
      console.error('Failed to fetch trackers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setMaskedEmails(data.maskedEmails || []);
        setLastTestEmailSent(data.lastTestEmailSent);
        if (data.lastTestEmailSent) {
          const elapsed = Date.now() - new Date(data.lastTestEmailSent).getTime();
          const remaining = Math.max(0, 30 * 60 * 1000 - elapsed);
          if (remaining > 0) setCountdown(Math.ceil(remaining / 1000));
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  }, []);

  useEffect(() => {
    fetchTrackers();
    fetchSettings();
    const interval = setInterval(fetchTrackers, 60_000);
    return () => clearInterval(interval);
  }, [fetchTrackers, fetchSettings]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
    }
  }, [countdown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleStop(id: string) {
    const res = await fetch(`/api/trackers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'stopped' }),
    });
    if (res.ok) fetchTrackers();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this tracker?')) return;
    const res = await fetch(`/api/trackers/${id}`, { method: 'DELETE' });
    if (res.ok) fetchTrackers();
  }

  async function handleAddEmail() {
    if (!newEmail) return;
    setAdding(true);
    setEmailError('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', email: newEmail }),
      });
      if (res.ok) {
        const data = await res.json();
        setMaskedEmails(data.maskedEmails);
        setNewEmail('');
      } else {
        const err = await res.json();
        setEmailError(err.error || 'Failed to add email');
      }
    } catch {
      setEmailError('Failed to add email');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveEmail(index: number) {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove', index }),
    });
    if (res.ok) {
      const data = await res.json();
      setMaskedEmails(data.maskedEmails);
    }
  }

  async function handleTestEmail() {
    setSendingTest(true);
    setTestStatus('idle');
    try {
      const res = await fetch('/api/test-email', { method: 'POST' });
      if (res.ok) {
        setTestStatus('success');
        setCountdown(30 * 60);
        setLastTestEmailSent(new Date().toISOString());
      } else if (res.status === 429) {
        const data = await res.json();
        setTestStatus('rate_limited');
        if (data.retryAfterMs) setCountdown(Math.ceil(data.retryAfterMs / 1000));
      } else {
        setTestStatus('error');
      }
    } catch {
      setTestStatus('error');
    } finally {
      setSendingTest(false);
      setTimeout(() => setTestStatus('idle'), 5000);
    }
  }

  function formatCountdown(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const polling = trackers.filter((t) => t.status === 'polling');
  const found = trackers.filter((t) => t.status === 'found');
  const stopped = trackers.filter((t) => t.status === 'stopped');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted mt-1">
            {polling.length} active tracker{polling.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/add"
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors"
        >
          + Add Tracker
        </Link>
      </div>

      {/* Trackers */}
      {loading ? (
        <div className="text-center py-12 text-muted">Loading trackers...</div>
      ) : trackers.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-card-border rounded-lg">
          <p className="text-muted mb-4">No trackers yet</p>
          <Link
            href="/add"
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors"
          >
            Add your first tracker
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {found.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-green uppercase tracking-wider mb-3">Bookings Found</h2>
              <div className="space-y-3">
                {found.map((t) => (
                  <TrackerCard key={t.id} tracker={t} onStop={handleStop} onDelete={handleDelete} />
                ))}
              </div>
            </section>
          )}
          {polling.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-yellow uppercase tracking-wider mb-3">Actively Polling</h2>
              <div className="space-y-3">
                {polling.map((t) => (
                  <TrackerCard key={t.id} tracker={t} onStop={handleStop} onDelete={handleDelete} />
                ))}
              </div>
            </section>
          )}
          {stopped.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Stopped</h2>
              <div className="space-y-3">
                {stopped.map((t) => (
                  <TrackerCard key={t.id} tracker={t} onStop={handleStop} onDelete={handleDelete} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Email Settings — matching Stock Tracker style */}
      <section className="border border-card-border rounded-xl bg-card p-5">
        <h2 className="font-semibold text-sm mb-4">Notification Emails</h2>

        {maskedEmails.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-4">
            {maskedEmails.map((masked, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 bg-background border border-card-border rounded-full px-3 py-1 text-sm"
              >
                <span className="font-mono text-xs">{masked}</span>
                <button
                  onClick={() => handleRemoveEmail(i)}
                  className="text-muted hover:text-red transition-colors text-sm leading-none"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted mb-4">
            No emails configured. Add an email to receive booking alerts.
          </p>
        )}

        <div className="flex gap-2 max-w-md">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => { setNewEmail(e.target.value); setEmailError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
            placeholder="Add email address..."
            className="flex-1 bg-background border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
          <button
            onClick={handleAddEmail}
            disabled={adding || !newEmail}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-lg disabled:opacity-40 transition-colors"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </div>
        {emailError && <p className="text-xs text-red mt-1">{emailError}</p>}

        {maskedEmails.length > 0 && (
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-card-border/50">
            <button
              onClick={handleTestEmail}
              disabled={sendingTest || countdown > 0}
              className="px-4 py-2 border border-card-border hover:border-accent text-sm rounded-lg disabled:opacity-40 transition-colors"
            >
              {sendingTest
                ? 'Sending...'
                : countdown > 0
                  ? `Wait ${formatCountdown(countdown)}`
                  : 'Send Test Email'}
            </button>
            {testStatus === 'success' && (
              <span className="text-sm text-green">Test email sent! Check your inbox.</span>
            )}
            {testStatus === 'error' && (
              <span className="text-sm text-red">Failed to send.</span>
            )}
            {testStatus === 'rate_limited' && (
              <span className="text-sm text-yellow">Rate limited. Please wait.</span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
