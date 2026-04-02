import { NextResponse } from 'next/server';
import { fetchTheatres } from '@/lib/pvr-service';

// GET /api/theatres?city=Bengaluru&filmCommonCode=34788&experience=IMAX
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const filmCommonCode = searchParams.get('filmCommonCode');
    const experience = searchParams.get('experience') || 'Any';

    if (!city || !filmCommonCode) {
      return NextResponse.json({ error: 'city and filmCommonCode are required' }, { status: 400 });
    }

    const theatres = await fetchTheatres(city, filmCommonCode, experience);
    return NextResponse.json(theatres);
  } catch (error) {
    console.error('[API] Failed to fetch theatres:', error);
    return NextResponse.json({ error: 'Failed to fetch theatres' }, { status: 500 });
  }
}
