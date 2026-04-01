/**
 * Local poller — runs every 4 minutes, checks PVR INOX for booking availability.
 *
 * Usage: npm run poll
 *
 * Reads active trackers from Cosmos DB, checks PVR API (needs residential IP),
 * updates tracker status, and sends email alerts via Azure Communication Services.
 */

import { CosmosClient } from '@azure/cosmos';
import { EmailClient } from '@azure/communication-email';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

const POLL_INTERVAL = 4 * 60 * 1000; // 4 minutes
const ERROR_THRESHOLD = 5;

// ─── Cosmos DB ─────────────────────────────────────────────────────

const cosmosClient = new CosmosClient({
  endpoint: process.env.COSMOS_DB_ENDPOINT!,
  key: process.env.COSMOS_DB_KEY!,
});
const database = cosmosClient.database(process.env.COSMOS_DB_DATABASE || 'bms-tracker');
const trackersContainer = database.container('trackers');
const settingsContainer = database.container('settings');

interface Tracker {
  id: string;
  movieTitle: string;
  filmCommonCode: string;
  experience: string;
  cityName: string;
  date: string;
  status: string;
  lastChecked: string | null;
  lastError: string | null;
  consecutiveErrors: number;
  bookingUrl: string | null;
  showsFound: Array<{ venue: string; time: string; screenAttr: string }> | null;
  createdAt: string;
  foundAt: string | null;
}

// ─── PVR API ───────────────────────────────────────────────────────

const PVR_API = 'https://api3.pvrcinemas.com/api';

function pvrHeaders(city: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'chain': 'PVR',
    'city': city,
    'appVersion': '17.2',
    'platform': 'WEB',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://www.pvrcinemas.com',
    'Referer': 'https://www.pvrcinemas.com/',
  };
}

interface PVRShowtimesResponse {
  days: unknown[];
  showTimeSessions: Array<{
    cinemaRe: { name: string };
    cinemaMovieSessions: Array<{
      movieRe: { films: Array<{ filmCommonCode: string }> };
      experienceSessions: Array<{
        experience?: string;
        shows: Array<{ showDate: string; showTime: string }>;
      }>;
    }>;
  }>;
}

async function checkAvailability(tracker: Tracker) {
  const dated = `${tracker.date.slice(0, 4)}-${tracker.date.slice(4, 6)}-${tracker.date.slice(6, 8)}`;

  const response = await fetch(`${PVR_API}/v1/booking/content/cshowtimes`, {
    method: 'POST',
    headers: pvrHeaders(tracker.cityName),
    body: JSON.stringify({ city: tracker.cityName, lat: '0.000', lng: '0.000', dated, minDistance: 0 }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`PVR API ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json() as { output: PVRShowtimesResponse };
  if (!data.output) throw new Error('PVR API returned no data');

  const shows: Array<{ venue: string; time: string; screenAttr: string }> = [];
  const targetExp = tracker.experience === 'Any' ? null : tracker.experience;

  for (const session of data.output.showTimeSessions) {
    for (const cms of session.cinemaMovieSessions) {
      if (!cms.movieRe.films?.some(f => f.filmCommonCode === tracker.filmCommonCode)) continue;

      for (const exp of cms.experienceSessions || []) {
        const expName = exp.experience || 'Standard';
        if (targetExp && expName !== targetExp) continue;

        for (const show of exp.shows || []) {
          if (show.showDate !== dated) continue;
          shows.push({ venue: session.cinemaRe.name, time: show.showTime, screenAttr: expName });
        }
      }
    }
  }

  return { available: shows.length > 0, shows, bookingUrl: 'https://www.pvrcinemas.com/show-timings' };
}

// ─── Email ─────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  const connectionString = process.env.AZURE_COMMUNICATION_ENDPOINT;
  const senderEmail = process.env.AZURE_SENDER_EMAIL;

  if (!connectionString || !senderEmail) {
    console.log(`  [Email] ${subject}`);
    console.log(`  [Email] To: ${to}`);
    console.log(`  [Email] ${body.split('\n')[0]}`);
    return false;
  }

  try {
    const client = new EmailClient(connectionString);
    const poller = await client.beginSend({
      senderAddress: senderEmail,
      content: { subject, plainText: body },
      recipients: { to: [{ address: to }] },
    });
    const result = await poller.pollUntilDone();
    return result.status === 'Succeeded';
  } catch (error) {
    console.error(`  [Email] Failed:`, error);
    return false;
  }
}

async function sendBookingAlert(tracker: Tracker) {
  const { resource } = await settingsContainer.item('user-settings', 'user-settings').read();
  const emails: string[] = resource?.notificationEmails || [];
  if (emails.length === 0) { console.log('  No notification emails configured'); return; }

  const showsList = (tracker.showsFound || [])
    .map(s => `  - ${s.venue} at ${s.time} (${s.screenAttr})`)
    .join('\n');

  const subject = `Bookings Open: ${tracker.movieTitle} - ${tracker.experience}`;
  const body = [
    `Bookings are now open for ${tracker.movieTitle}!`,
    '', `Format: ${tracker.experience}`, `City: ${tracker.cityName}`, `Date: ${tracker.date}`,
    '', 'Available shows:', showsList || '  (Check PVR INOX for details)',
    '', `Book now: ${tracker.bookingUrl || 'https://www.pvrcinemas.com/show-timings'}`,
  ].join('\n');

  for (const email of emails) {
    const sent = await sendEmail(email, subject, body);
    console.log(`  Email to ${email}: ${sent ? 'sent' : 'logged'}`);
  }
}

async function sendErrorAlert(tracker: Tracker) {
  const { resource } = await settingsContainer.item('user-settings', 'user-settings').read();
  const emails: string[] = resource?.notificationEmails || [];
  if (emails.length === 0) return;

  const subject = `Tracker Error: ${tracker.movieTitle}`;
  const body = `Tracker for "${tracker.movieTitle}" (${tracker.experience}) has failed ${tracker.consecutiveErrors} times.\n\nLast error: ${tracker.lastError}`;

  for (const email of emails) {
    await sendEmail(email, subject, body);
  }
}

// ─── Poll Loop ─────────────────────────────────────────────────────

async function pollOnce() {
  const { resources: trackers } = await trackersContainer.items
    .query("SELECT * FROM c WHERE c.status = 'polling'")
    .fetchAll();

  if (trackers.length === 0) {
    console.log(`[${ts()}] No active trackers`);
    return;
  }

  console.log(`[${ts()}] Checking ${trackers.length} tracker(s)...`);

  for (const tracker of trackers as Tracker[]) {
    try {
      const result = await checkAvailability(tracker);

      if (result.available) {
        console.log(`  \x1b[32mFOUND: ${tracker.movieTitle} — ${result.shows.length} shows!\x1b[0m`);
        const updated = {
          ...tracker,
          status: 'found',
          lastChecked: new Date().toISOString(),
          lastError: null,
          consecutiveErrors: 0,
          bookingUrl: result.bookingUrl,
          showsFound: result.shows,
          foundAt: new Date().toISOString(),
        };
        await trackersContainer.items.upsert(updated);
        await sendBookingAlert(updated);
      } else {
        console.log(`  ${tracker.movieTitle} (${tracker.experience}) — not available yet`);
        await trackersContainer.items.upsert({
          ...tracker,
          lastChecked: new Date().toISOString(),
          lastError: null,
          consecutiveErrors: 0,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const newErrorCount = tracker.consecutiveErrors + 1;
      console.log(`  \x1b[31mERROR: ${tracker.movieTitle} — ${errorMsg.slice(0, 100)}\x1b[0m`);

      await trackersContainer.items.upsert({
        ...tracker,
        lastChecked: new Date().toISOString(),
        lastError: errorMsg,
        consecutiveErrors: newErrorCount,
      });

      if (newErrorCount === ERROR_THRESHOLD) {
        await sendErrorAlert({ ...tracker, consecutiveErrors: newErrorCount, lastError: errorMsg });
      }
    }
  }
}

function ts() {
  return new Date().toLocaleTimeString('en-IN', { hour12: false });
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log('\x1b[36m=== BMS Tracker — Local Poller ===\x1b[0m');
  console.log(`Polling every ${POLL_INTERVAL / 60000} minutes`);
  console.log(`Cosmos DB: ${process.env.COSMOS_DB_ENDPOINT?.slice(0, 30)}...`);
  console.log(`Email: ${process.env.AZURE_SENDER_EMAIL || 'not configured (will log to console)'}`);
  console.log('');

  // Initial poll
  await pollOnce();

  // Schedule recurring polls
  setInterval(async () => {
    try {
      await pollOnce();
    } catch (error) {
      console.error(`[${ts()}] Poll failed:`, error);
    }
  }, POLL_INTERVAL);
}

main().catch(console.error);
