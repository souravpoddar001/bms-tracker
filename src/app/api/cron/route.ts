import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { checkAvailability } from '@/lib/pvr-service';
import { sendBookingAlert, sendErrorAlert } from '@/lib/email-service';

const ERROR_THRESHOLD = 5;

// GET /api/cron — Called by Azure Functions Timer to check all active trackers
export async function GET() {
  try {
    const activeTrackers = await db.getActiveTrackers();

    if (activeTrackers.length === 0) {
      return NextResponse.json({ message: 'No active trackers', results: [] });
    }

    const results = await Promise.allSettled(
      activeTrackers.map(async (tracker) => {
        try {
          const result = await checkAvailability(
            tracker.cityName,
            tracker.filmCommonCode,
            tracker.experience,
            tracker.date,
            tracker.theatreId
          );

          if (result.available) {
            await db.updateTracker(tracker.id, {
              status: 'found',
              lastChecked: new Date().toISOString(),
              lastError: null,
              consecutiveErrors: 0,
              bookingUrl: result.bookingUrl,
              showsFound: result.shows,
              foundAt: new Date().toISOString(),
            });

            const updatedTracker = await db.getTracker(tracker.id);
            if (updatedTracker) await sendBookingAlert(updatedTracker);

            return { id: tracker.id, movieTitle: tracker.movieTitle, status: 'found' };
          } else {
            await db.updateTracker(tracker.id, {
              lastChecked: new Date().toISOString(),
              lastError: null,
              consecutiveErrors: 0,
            });
            return { id: tracker.id, movieTitle: tracker.movieTitle, status: 'not_available' };
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const newErrorCount = tracker.consecutiveErrors + 1;

          await db.updateTracker(tracker.id, {
            lastChecked: new Date().toISOString(),
            lastError: errorMsg,
            consecutiveErrors: newErrorCount,
          });

          if (newErrorCount === ERROR_THRESHOLD) {
            const updatedTracker = await db.getTracker(tracker.id);
            if (updatedTracker) await sendErrorAlert(updatedTracker);
          }

          return { id: tracker.id, movieTitle: tracker.movieTitle, status: 'error', error: errorMsg };
        }
      })
    );

    const summary = results.map((r) =>
      r.status === 'fulfilled' ? r.value : { status: 'error', error: String(r.reason) }
    );

    return NextResponse.json({ message: `Checked ${activeTrackers.length} tracker(s)`, results: summary });
  } catch (error) {
    console.error('[Cron] Fatal error:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
