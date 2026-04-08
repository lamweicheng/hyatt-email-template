import { NextResponse } from 'next/server';
import { isDatabaseConfigured, normalizeRouteError, reorderHotels } from '@/lib/hotels';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { message: 'Database persistence is not configured.' },
      { status: 503 }
    );
  }

  try {
    const payload = await request.json();
    await reorderHotels(payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const normalized = normalizeRouteError(error);
    return NextResponse.json({ message: normalized.message }, { status: normalized.status });
  }
}