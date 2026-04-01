import { NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import * as db from '@/lib/db';
import type { Tracker } from '@/lib/types';

// GET /api/trackers — List all trackers
export async function GET() {
  try {
    const trackers = await db.getTrackers();
    return NextResponse.json(trackers);
  } catch (error) {
    console.error('Failed to fetch trackers:', error);
    return NextResponse.json({ error: 'Failed to fetch trackers' }, { status: 500 });
  }
}

// POST /api/trackers — Create a new tracker
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { movieTitle, movieSlug, eventCode, formatEventCode, formatLabel, cityCode, cityName, date } = body;

    if (!movieTitle || !movieSlug || !eventCode || !formatEventCode || !formatLabel || !cityCode || !cityName || !date) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    // Validate formats to prevent injection via URL construction
    if (!/^[a-zA-Z0-9-]+$/.test(movieSlug)) {
      return NextResponse.json({ error: 'Invalid movieSlug format' }, { status: 400 });
    }
    if (!/^[A-Z]{2,10}$/.test(cityCode)) {
      return NextResponse.json({ error: 'Invalid cityCode format' }, { status: 400 });
    }
    if (!/^ET\d+$/.test(eventCode) || !/^ET\d+$/.test(formatEventCode)) {
      return NextResponse.json({ error: 'Invalid eventCode format' }, { status: 400 });
    }
    if (!/^\d{8}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format (expected YYYYMMDD)' }, { status: 400 });
    }

    const tracker: Tracker = {
      id: uuid(),
      movieTitle,
      movieSlug,
      eventCode,
      formatEventCode,
      formatLabel,
      cityCode,
      cityName,
      date,
      status: 'polling',
      lastChecked: null,
      lastError: null,
      consecutiveErrors: 0,
      bookingUrl: null,
      showsFound: null,
      createdAt: new Date().toISOString(),
      foundAt: null,
    };

    await db.createTracker(tracker);
    return NextResponse.json(tracker, { status: 201 });
  } catch (error) {
    console.error('Failed to create tracker:', error);
    return NextResponse.json({ error: 'Failed to create tracker' }, { status: 500 });
  }
}
