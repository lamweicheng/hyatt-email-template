import { z } from 'zod';

const topicSchema = z.object({
  id: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1, 'Topic title is required').max(120, 'Max 120 characters'),
  content: z.string().trim().min(1, 'Topic content is required').max(4000, 'Max 4000 characters')
});

const emailTemplateSettingsBaseSchema = z.object({
  defaultTemplate: z
    .string()
    .trim()
    .min(1, 'Default template is required')
    .max(12000, 'Default template is too long'),
  topics: z.array(topicSchema).default([]),
  selectedTopicIds: z.array(z.string().trim().min(1)).default([])
});

export const emailTemplateSettingsSchema = emailTemplateSettingsBaseSchema.transform((value) => {
    const topics = value.topics.map((topic) => ({
      id: topic.id?.trim() || crypto.randomUUID(),
      title: topic.title.trim(),
      content: topic.content.trim()
    }));
    const topicIds = new Set(topics.map((topic) => topic.id));

    return {
      defaultTemplate: value.defaultTemplate.replace(/\r\n/g, '\n'),
      topics,
      selectedTopicIds: value.selectedTopicIds.filter((topicId) => topicIds.has(topicId))
    };
  });

export const emailTemplateSettingsPatchSchema = emailTemplateSettingsBaseSchema.partial();

export type EmailTemplateSettingsPayload = z.infer<typeof emailTemplateSettingsSchema>;
export type EmailTemplateSettingsPatchPayload = z.infer<typeof emailTemplateSettingsPatchSchema>;