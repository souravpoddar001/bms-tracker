import { NextResponse } from 'next/server';
import { searchMovies } from '@/lib/pvr-service';

// GET /api/movies?city=Bengaluru&q=hail — Search movies in a city
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const query = (searchParams.get('q') || '').toLowerCase().trim();

    if (!city) {
      return NextResponse.json({ error: 'city is required' }, { status: 400 });
    }

    const movies = await searchMovies(city);

    if (!query) {
      return NextResponse.json(movies);
    }

    const filtered = movies.filter((m) =>
      m.filmName.toLowerCase().includes(query)
    );

    return NextResponse.json(filtered);
  } catch (error) {
    console.error('[API] Failed to fetch movies:', error);
    return NextResponse.json({ error: 'Failed to fetch movies' }, { status: 500 });
  }
}
