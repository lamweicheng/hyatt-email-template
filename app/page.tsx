import { EmailTemplateBuilderClient } from './EmailTemplateBuilderClient';
import { isDatabaseConfigured, listEmailTemplateSettings } from '@/lib/email-template-settings';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const initialSettings = await listEmailTemplateSettings();

  return (
    <EmailTemplateBuilderClient
      initialSettings={initialSettings}
      persistenceMode={isDatabaseConfigured() ? 'database' : 'local'}
    />
  );
}