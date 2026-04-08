import { NextResponse } from 'next/server';
import { createHotel, isDatabaseConfigured, listHotels, normalizeRouteError } from '@/lib/hotels';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    hotels: await listHotels(),
    persistenceMode: isDatabaseConfigured() ? 'database' : 'local'
  });
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { message: 'Database persistence is not configured.' },
      { status: 503 }
    );
  }

  try {
    const payload = await request.json();
    const hotel = await createHotel(payload);
    return NextResponse.json({ hotel }, { status: 201 });
  } catch (error) {
    const normalized = normalizeRouteError(error);
    return NextResponse.json({ message: normalized.message }, { status: normalized.status });
  }
}