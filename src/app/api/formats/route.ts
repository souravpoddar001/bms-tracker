import { NextResponse } from 'next/server';
import { fetchFormats } from '@/lib/bms-service';

// GET /api/formats?cityCode=BANG&movieSlug=avengers&eventCode=ET00469257
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cityCode = searchParams.get('cityCode');
    const movieSlug = searchParams.get('movieSlug');
    const eventCode = searchParams.get('eventCode');

    if (!cityCode || !movieSlug || !eventCode) {
      return NextResponse.json(
        { error: 'cityCode, movieSlug, and eventCode are required' },
        { status: 400 }
      );
    }

    const formats = await fetchFormats(cityCode, movieSlug, eventCode);
    return NextResponse.json(formats);
  } catch (error) {
    console.error('[API] Failed to fetch formats:', error);
    return NextResponse.json({ error: 'Failed to fetch formats from BookMyShow' }, { status: 500 });
  }
}
