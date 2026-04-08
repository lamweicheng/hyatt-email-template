import { NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/hotels';
import {
  listDashboardPreferences,
  normalizeDashboardPreferencesError,
  saveDashboardPreferences
} from '@/lib/dashboard-preferences';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    preferences: await listDashboardPreferences(),
    persistenceMode: isDatabaseConfigured() ? 'database' : 'local'
  });
}

export async function PUT(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { message: 'Database persistence is not configured.' },
      { status: 503 }
    );
  }

  try {
    const payload = await request.json();
    const preferences = await saveDashboardPreferences(payload);
    return NextResponse.json({ preferences });
  } catch (error) {
    const normalized = normalizeDashboardPreferencesError(error);
    return NextResponse.json({ message: normalized.message }, { status: normalized.status });
  }
}