import { NextResponse } from 'next/server';
import { searchMovies } from '@/lib/bms-service';

// GET /api/movies?citySlug=bengaluru&q=avengers — Search movies in a city
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const citySlug = searchParams.get('citySlug');
    const query = (searchParams.get('q') || '').toLowerCase().trim();

    if (!citySlug) {
      return NextResponse.json({ error: 'citySlug is required' }, { status: 400 });
    }

    const movies = await searchMovies(citySlug);

    if (!query) {
      return NextResponse.json(movies);
    }

    const filtered = movies.filter((m) =>
      m.title.toLowerCase().includes(query)
    );

    return NextResponse.json(filtered);
  } catch (error) {
    console.error('[API] Failed to fetch movies:', error);
    return NextResponse.json({ error: 'Failed to fetch movies from BookMyShow' }, { status: 500 });
  }
}
