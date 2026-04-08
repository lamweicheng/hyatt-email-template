import { NextResponse } from 'next/server';
import {
  isDatabaseConfigured,
  listEmailTemplateSettings,
  normalizeEmailTemplateSettingsError,
  saveEmailTemplateSettings
} from '@/lib/email-template-settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    settings: await listEmailTemplateSettings(),
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
    const settings = await saveEmailTemplateSettings(payload);
    return NextResponse.json({ settings });
  } catch (error) {
    const normalized = normalizeEmailTemplateSettingsError(error);
    return NextResponse.json({ message: normalized.message }, { status: normalized.status });
  }
}