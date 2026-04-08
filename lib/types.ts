export type PersistenceMode = 'database' | 'local';

export type EmailTopic = {
  id: string;
  title: string;
  content: string;
};

export type EmailTemplateSettingsRecord = {
  defaultTemplate: string;
  topics: EmailTopic[];
  selectedTopicIds: string[];
};

export type EmailTemplateSettingsPatch = Partial<EmailTemplateSettingsRecord>;
