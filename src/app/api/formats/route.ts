import { NextResponse } from 'next/server';
import { fetchFormats } from '@/lib/pvr-service';

// GET /api/formats?city=Bengaluru&filmCommonCode=36402
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const filmCommonCode = searchParams.get('filmCommonCode');

    if (!city || !filmCommonCode) {
      return NextResponse.json(
        { error: 'city and filmCommonCode are required' },
        { status: 400 }
      );
    }

    const formats = await fetchFormats(city, filmCommonCode);
    return NextResponse.json(formats);
  } catch (error) {
    console.error('[API] Failed to fetch formats:', error);
    return NextResponse.json({ error: 'Failed to fetch formats' }, { status: 500 });
  }
}
