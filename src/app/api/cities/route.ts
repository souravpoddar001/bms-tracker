import { NextResponse } from 'next/server';
import { fetchCities } from '@/lib/bms-service';

// GET /api/cities?q=bang — Search BMS cities
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('q') || '').toLowerCase().trim();

    const cities = await fetchCities();

    if (!query) {
      return NextResponse.json(cities);
    }

    const filtered = cities.filter(
      (c) =>
        c.regionName.toLowerCase().includes(query) ||
        c.regionCode.toLowerCase().includes(query) ||
        c.alias.some((a) => a.toLowerCase().includes(query))
    );

    return NextResponse.json(filtered);
  } catch (error) {
    console.error('[API] Failed to fetch cities:', error);
    return NextResponse.json({ error: 'Failed to fetch cities from BookMyShow' }, { status: 500 });
  }
}
