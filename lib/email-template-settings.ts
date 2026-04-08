import 'server-only';

import { ZodError } from 'zod';
import { getPrismaClient } from './prisma';
import type { EmailTemplateSettingsPatch, EmailTemplateSettingsRecord, EmailTopic } from './types';
import { emailTemplateSettingsPatchSchema, emailTemplateSettingsSchema } from './validation';

const SETTINGS_ID = 'default';

export const DEFAULT_EMAIL_TEMPLATE_SETTINGS: EmailTemplateSettingsRecord = {
  defaultTemplate: `Hi {{managerName}},

I am Lam Wei Cheng.

Hotel: {{hotelName}}
Confirmation Number: {{confirmationNumber}}

{{topics}}

Best regards,
Lam Wei Cheng`,
  topics: [
    {
      id: 'anniversary',
      title: 'Anniversary',
      content:
        'Congratulations on your work anniversary with Hyatt. Thank you for your continued dedication and contribution to the team.'
    },
    {
      id: 'appreciation',
      title: 'Appreciation',
      content: 'Thank you for your support and guidance. I appreciate the time and effort you continue to invest in the team.'
    }
  ],
  selectedTopicIds: ['anniversary']
};

type EmailTemplateSettingsRow = {
  defaultTemplate: string;
  topics: unknown;
  selectedTopicIds: unknown;
};

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function normalizeTopics(value: unknown): EmailTopic[] {
  if (!Array.isArray(value)) {
    return DEFAULT_EMAIL_TEMPLATE_SETTINGS.topics;
  }

  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry) => ({
      id: typeof entry.id === 'string' && entry.id.trim() ? entry.id : crypto.randomUUID(),
      title: typeof entry.title === 'string' ? entry.title.trim() : '',
      content: typeof entry.content === 'string' ? entry.content.trim() : ''
    }))
    .filter((topic) => topic.title.length > 0 && topic.content.length > 0);
}

export function normalizeEmailTemplateSettings(value: unknown): EmailTemplateSettingsRecord {
  const record = (typeof value === 'object' && value !== null ? value : {}) as Partial<EmailTemplateSettingsRow>;
  const topics = normalizeTopics(record.topics);
  const topicIds = new Set(topics.map((topic) => topic.id));

  return {
    defaultTemplate:
      typeof record.defaultTemplate === 'string' && record.defaultTemplate.trim()
        ? record.defaultTemplate.replace(/\r\n/g, '\n')
        : DEFAULT_EMAIL_TEMPLATE_SETTINGS.defaultTemplate,
    topics,
    selectedTopicIds: Array.isArray(record.selectedTopicIds)
      ? record.selectedTopicIds.filter((topicId): topicId is string => typeof topicId === 'string' && topicIds.has(topicId))
      : DEFAULT_EMAIL_TEMPLATE_SETTINGS.selectedTopicIds
  };
}

export async function listEmailTemplateSettings() {
  if (!isDatabaseConfigured()) {
    return DEFAULT_EMAIL_TEMPLATE_SETTINGS;
  }

  try {
    const settings = await getPrismaClient().emailTemplateSettings.findUnique({
      where: { id: SETTINGS_ID }
    });

    if (!settings) {
      return DEFAULT_EMAIL_TEMPLATE_SETTINGS;
    }

    return normalizeEmailTemplateSettings(settings);
  } catch {
    return DEFAULT_EMAIL_TEMPLATE_SETTINGS;
  }
}

export async function saveEmailTemplateSettings(
  payload: EmailTemplateSettingsPatch | EmailTemplateSettingsRecord
) {
  const patch = emailTemplateSettingsPatchSchema.parse(payload);
  const currentSettings = await listEmailTemplateSettings();
  const data = emailTemplateSettingsSchema.parse({
    defaultTemplate: patch.defaultTemplate ?? currentSettings.defaultTemplate,
    topics: patch.topics ?? currentSettings.topics,
    selectedTopicIds: patch.selectedTopicIds ?? currentSettings.selectedTopicIds
  });

  const settings = await getPrismaClient().emailTemplateSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      defaultTemplate: data.defaultTemplate,
      topics: data.topics,
      selectedTopicIds: data.selectedTopicIds
    },
    update: {
      defaultTemplate: data.defaultTemplate,
      topics: data.topics,
      selectedTopicIds: data.selectedTopicIds
    }
  });

  return normalizeEmailTemplateSettings(settings);
}

export function normalizeEmailTemplateSettingsError(error: unknown) {
  if (error instanceof ZodError) {
    return {
      status: 400,
      message: error.issues[0]?.message || 'Invalid template settings payload.'
    };
  }

  if (error instanceof Error) {
    return {
      status: 500,
      message: error.message || 'Something went wrong.'
    };
  }

  return {
    status: 500,
    message: 'Something went wrong.'
  };
}