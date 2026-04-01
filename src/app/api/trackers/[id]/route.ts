import { NextResponse } from 'next/server';
import * as db from '@/lib/db';

// GET /api/trackers/[id]
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tracker = await db.getTracker(id);
    if (!tracker) {
      return NextResponse.json({ error: 'Tracker not found' }, { status: 404 });
    }
    return NextResponse.json(tracker);
  } catch (error) {
    console.error('Failed to fetch tracker:', error);
    return NextResponse.json({ error: 'Failed to fetch tracker' }, { status: 500 });
  }
}

// PUT /api/trackers/[id] — Update tracker (e.g., stop polling)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Whitelist allowed fields — only status can be changed by the client
    const allowedUpdates: Record<string, unknown> = {};
    if (body.status === 'stopped' || body.status === 'polling') {
      allowedUpdates.status = body.status;
    }
    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await db.updateTracker(id, allowedUpdates);
    if (!updated) {
      return NextResponse.json({ error: 'Tracker not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update tracker:', error);
    return NextResponse.json({ error: 'Failed to update tracker' }, { status: 500 });
  }
}

// DELETE /api/trackers/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await db.deleteTracker(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Tracker not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete tracker:', error);
    return NextResponse.json({ error: 'Failed to delete tracker' }, { status: 500 });
  }
}
