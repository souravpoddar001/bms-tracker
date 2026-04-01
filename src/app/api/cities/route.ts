import { NextResponse } from 'next/server';
import { fetchCities } from '@/lib/pvr-service';

// GET /api/cities?q=bang — Search PVR INOX cities
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('q') || '').toLowerCase().trim();

    const cities = await fetchCities();

    if (!query) {
      return NextResponse.json(cities);
    }

    const filtered = cities.filter(
      (c) => c.name.toLowerCase().includes(query)
    );

    return NextResponse.json(filtered);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[API] Failed to fetch cities:', msg);
    return NextResponse.json({ error: 'Failed to fetch cities', detail: msg }, { status: 500 });
  }
}
