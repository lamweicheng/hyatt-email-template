import { NextResponse } from 'next/server';
import { deleteHotel, isDatabaseConfigured, normalizeRouteError, updateHotel } from '@/lib/hotels';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { message: 'Database persistence is not configured.' },
      { status: 503 }
    );
  }

  try {
    const payload = await request.json();
    const hotel = await updateHotel(params.id, payload);
    return NextResponse.json({ hotel });
  } catch (error) {
    const normalized = normalizeRouteError(error);
    return NextResponse.json({ message: normalized.message }, { status: normalized.status });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { message: 'Database persistence is not configured.' },
      { status: 503 }
    );
  }

  try {
    await deleteHotel(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const normalized = normalizeRouteError(error);
    return NextResponse.json({ message: normalized.message }, { status: normalized.status });
  }
}