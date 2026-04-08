'use client';

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { EmailTemplateSettingsRecord, EmailTopic, PersistenceMode } from '@/lib/types';

const LOCAL_STORAGE_KEY = 'hyatt-email-template.settings';
const TOPICS_PLACEHOLDER = '{{topics}}';
const MANAGER_PLACEHOLDER = '{{managerName}}';
const HOTEL_PLACEHOLDER = '{{hotelName}}';
const CONFIRMATION_PLACEHOLDER = '{{confirmationNumber}}';

type EmailTemplateBuilderClientProps = {
  initialSettings: EmailTemplateSettingsRecord;
  persistenceMode: PersistenceMode;
};

function createEmptyTopic(): EmailTopic {
  return {
    id: crypto.randomUUID(),
    title: '',
    content: ''
  };
}

function normalizeClientSettings(
  value: unknown,
  fallback: EmailTemplateSettingsRecord
): EmailTemplateSettingsRecord {
  const record = (typeof value === 'object' && value !== null ? value : {}) as Partial<EmailTemplateSettingsRecord>;
  const topics = Array.isArray(record.topics)
    ? record.topics
        .filter((entry): entry is EmailTopic => typeof entry === 'object' && entry !== null)
        .map((topic) => ({
          id: typeof topic.id === 'string' && topic.id.trim() ? topic.id : crypto.randomUUID(),
          title: typeof topic.title === 'string' ? topic.title : '',
          content: typeof topic.content === 'string' ? topic.content : ''
        }))
    : fallback.topics;
  const topicIds = new Set(topics.map((topic) => topic.id));

  return {
    defaultTemplate:
      typeof record.defaultTemplate === 'string' && record.defaultTemplate.trim()
        ? record.defaultTemplate
        : fallback.defaultTemplate,
    topics,
    selectedTopicIds: Array.isArray(record.selectedTopicIds)
      ? record.selectedTopicIds.filter((topicId): topicId is string => typeof topicId === 'string' && topicIds.has(topicId))
      : fallback.selectedTopicIds
  };
}

function buildEmail(
  defaultTemplate: string,
  selectedTopicContent: string,
  bookingDetails: { managerName: string; hotelName: string; confirmationNumber: string }
) {
  const normalizedTemplate = defaultTemplate.replace(/\r\n/g, '\n');
  const hasHotelPlaceholder = normalizedTemplate.includes(HOTEL_PLACEHOLDER);
  const hasConfirmationPlaceholder = normalizedTemplate.includes(CONFIRMATION_PLACEHOLDER);
  const bookingSummary = [
    hasHotelPlaceholder ? '' : `Hotel: ${bookingDetails.hotelName}`,
    hasConfirmationPlaceholder ? '' : `Confirmation Number: ${bookingDetails.confirmationNumber}`
  ]
    .filter(Boolean)
    .join('\n');
  const topicBlock = [bookingSummary, selectedTopicContent].filter(Boolean).join('\n\n');
  const mergedTemplate = normalizedTemplate
    .replace(/\{\{managerName\}\}/g, bookingDetails.managerName)
    .replace(/\{\{hotelName\}\}/g, bookingDetails.hotelName)
    .replace(/\{\{confirmationNumber\}\}/g, bookingDetails.confirmationNumber)
    .replace(/\[Manager's Name\]/g, bookingDetails.managerName);
  const merged = mergedTemplate.includes(TOPICS_PLACEHOLDER)
    ? mergedTemplate.replace(/\{\{topics\}\}/g, topicBlock)
    : [mergedTemplate.trimEnd(), topicBlock].filter(Boolean).join('\n\n');

  return merged.replace(/\n{3,}/g, '\n\n').trim();
}

function moveListItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

function EditorModal({
  title,
  description,
  onClose,
  children
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,28,36,0.42)] px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="glass-panel max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[30px]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(15,95,135,0.12)] px-6 py-5 sm:px-8">
          <div>
            <p className="section-label">Editor</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[rgb(var(--page-foreground))]">
              {title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[rgba(27,47,64,0.72)]">{description}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[rgba(15,95,135,0.14)] bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--wine))] transition hover:-translate-y-0.5"
          >
            Close
          </button>
        </div>

        <div className="max-h-[calc(90vh-116px)] overflow-y-auto px-6 py-6 sm:px-8">{children}</div>
      </div>
    </div>
  );
}

export function EmailTemplateBuilderClient({
  initialSettings,
  persistenceMode
}: EmailTemplateBuilderClientProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [lastSavedSettings, setLastSavedSettings] = useState(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [isHydrated, setIsHydrated] = useState(persistenceMode === 'database');
  const [managerName, setManagerName] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [confirmationNumber, setConfirmationNumber] = useState('');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isTopicsModalOpen, setIsTopicsModalOpen] = useState(false);
  const baseEmailTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previewTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (persistenceMode !== 'local') {
      setSettings(initialSettings);
      setLastSavedSettings(initialSettings);
      setIsHydrated(true);
      return;
    }

    try {
      const rawSettings = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (rawSettings) {
        const normalizedSettings = normalizeClientSettings(JSON.parse(rawSettings), initialSettings);
        setSettings(normalizedSettings);
        setLastSavedSettings(normalizedSettings);
      } else {
        setSettings(initialSettings);
        setLastSavedSettings(initialSettings);
      }
    } catch {
      setSaveFeedback({
        tone: 'error',
        message: 'Unable to read saved settings.'
      });
    } finally {
      setIsHydrated(true);
    }
  }, [initialSettings, persistenceMode]);

  useEffect(() => {
    if (copyState === 'idle') {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopyState('idle'), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copyState]);

  const selectedTopics = useMemo(() => {
    const topicsById = new Map(settings.topics.map((topic) => [topic.id, topic]));

    return settings.selectedTopicIds
      .map((topicId) => topicsById.get(topicId) ?? null)
      .filter((topic): topic is EmailTopic => topic !== null);
  }, [settings.selectedTopicIds, settings.topics]);

  const selectedTopicContent = useMemo(
    () => selectedTopics.map((topic) => topic.content.trim()).filter(Boolean).join('\n\n'),
    [selectedTopics]
  );

  const finalEmail = useMemo(
    () =>
      buildEmail(settings.defaultTemplate, selectedTopicContent, {
        managerName: managerName.trim() || '[Manager Name]',
        hotelName: hotelName.trim() || '[Hotel Name]',
        confirmationNumber: confirmationNumber.trim() || '[Confirmation Number]'
      }),
    [confirmationNumber, hotelName, managerName, selectedTopicContent, settings.defaultTemplate]
  );

  useEffect(() => {
    const baseEmailTextarea = baseEmailTextareaRef.current;

    if (!baseEmailTextarea || !isTemplateModalOpen) {
      return;
    }

    baseEmailTextarea.style.height = '0px';
    baseEmailTextarea.style.height = `${baseEmailTextarea.scrollHeight}px`;
  }, [isTemplateModalOpen, settings.defaultTemplate]);

  useEffect(() => {
    const previewTextarea = previewTextareaRef.current;

    if (!previewTextarea) {
      return;
    }

    previewTextarea.style.height = '0px';
    previewTextarea.style.height = `${previewTextarea.scrollHeight}px`;
  }, [finalEmail]);

  const templateIsDirty = settings.defaultTemplate !== lastSavedSettings.defaultTemplate;
  const topicsAreDirty =
    JSON.stringify({ topics: settings.topics, selectedTopicIds: settings.selectedTopicIds }) !==
    JSON.stringify({ topics: lastSavedSettings.topics, selectedTopicIds: lastSavedSettings.selectedTopicIds });
  const hasUnsavedChanges = templateIsDirty || topicsAreDirty;

  useEffect(() => {
    if (hasUnsavedChanges && saveFeedback?.tone === 'success') {
      setSaveFeedback(null);
    }
  }, [hasUnsavedChanges, saveFeedback]);

  const saveMessage =
    isSaving
      ? 'Saving changes...'
      : saveFeedback
        ? saveFeedback.message
        : hasUnsavedChanges
          ? 'You have unsaved changes.'
          : persistenceMode === 'local'
            ? 'Saved in this browser.'
            : 'Saved to the database.';

  async function saveSettingsPatch(
    patch: Partial<EmailTemplateSettingsRecord>,
    successMessage: string
  ) {
    if (!isHydrated) {
      return false;
    }

    setIsSaving(true);
    setSaveFeedback(null);

    const nextSavedSettings: EmailTemplateSettingsRecord = {
      defaultTemplate: patch.defaultTemplate ?? lastSavedSettings.defaultTemplate,
      topics: patch.topics ?? lastSavedSettings.topics,
      selectedTopicIds: patch.selectedTopicIds ?? lastSavedSettings.selectedTopicIds
    };

    try {
      if (persistenceMode === 'local') {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextSavedSettings));
        setLastSavedSettings(nextSavedSettings);
        setSettings((currentSettings) => ({
          defaultTemplate:
            patch.defaultTemplate === undefined ? currentSettings.defaultTemplate : nextSavedSettings.defaultTemplate,
          topics: patch.topics === undefined ? currentSettings.topics : nextSavedSettings.topics,
          selectedTopicIds:
            patch.selectedTopicIds === undefined
              ? currentSettings.selectedTopicIds
              : nextSavedSettings.selectedTopicIds
        }));
      } else {
        const response = await fetch('/api/template-settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(patch)
        });
        const result = (await response.json()) as {
          message?: string;
          settings?: EmailTemplateSettingsRecord;
        };

        if (!response.ok || !result.settings) {
          throw new Error(result.message || 'Failed to save template settings.');
        }

        const savedSettings = result.settings;

        setLastSavedSettings(savedSettings);
        setSettings((currentSettings) => ({
          defaultTemplate:
            patch.defaultTemplate === undefined ? currentSettings.defaultTemplate : savedSettings.defaultTemplate,
          topics: patch.topics === undefined ? currentSettings.topics : savedSettings.topics,
          selectedTopicIds:
            patch.selectedTopicIds === undefined
              ? currentSettings.selectedTopicIds
              : savedSettings.selectedTopicIds
        }));
      }

      setSaveFeedback({
        tone: 'success',
        message: successMessage
      });
      return true;
    } catch (error) {
      setSaveFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to save your changes.'
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function saveTemplate() {
    return saveSettingsPatch(
      { defaultTemplate: settings.defaultTemplate },
      persistenceMode === 'local' ? 'Template saved in this browser.' : 'Template saved to the database.'
    );
  }

  async function saveTopics() {
    return saveSettingsPatch(
      {
        topics: settings.topics,
        selectedTopicIds: settings.selectedTopicIds
      },
      persistenceMode === 'local' ? 'Topic settings saved in this browser.' : 'Topic settings saved to the database.'
    );
  }

  async function saveAllChanges() {
    await saveSettingsPatch(
      settings,
      persistenceMode === 'local' ? 'All changes saved in this browser.' : 'All changes saved to the database.'
    );
  }

  function updateTopic(topicId: string, field: 'title' | 'content', value: string) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      topics: currentSettings.topics.map((topic) =>
        topic.id === topicId
          ? {
              ...topic,
              [field]: value
            }
          : topic
      )
    }));
  }

  function addTopic() {
    const newTopic = createEmptyTopic();

    setSettings((currentSettings) => ({
      ...currentSettings,
      topics: [...currentSettings.topics, newTopic]
    }));
  }

  function removeTopic(topicId: string) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      topics: currentSettings.topics.filter((topic) => topic.id !== topicId),
      selectedTopicIds: currentSettings.selectedTopicIds.filter((selectedId) => selectedId !== topicId)
    }));
  }

  function toggleTopic(topicId: string) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      selectedTopicIds: currentSettings.selectedTopicIds.includes(topicId)
        ? currentSettings.selectedTopicIds.filter((selectedId) => selectedId !== topicId)
        : [...currentSettings.selectedTopicIds, topicId]
    }));
  }

  function selectAllTopics() {
    setSettings((currentSettings) => ({
      ...currentSettings,
      selectedTopicIds: currentSettings.topics.map((topic) => topic.id)
    }));
  }

  function clearSelectedTopics() {
    setSettings((currentSettings) => ({
      ...currentSettings,
      selectedTopicIds: []
    }));
  }

  function moveSelectedTopic(topicId: string, direction: 'up' | 'down') {
    setSettings((currentSettings) => {
      const currentIndex = currentSettings.selectedTopicIds.findIndex((selectedId) => selectedId === topicId);
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      return {
        ...currentSettings,
        selectedTopicIds: moveListItem(currentSettings.selectedTopicIds, currentIndex, targetIndex)
      };
    });
  }

  function moveTopic(topicId: string, direction: 'up' | 'down') {
    setSettings((currentSettings) => {
      const currentIndex = currentSettings.topics.findIndex((topic) => topic.id === topicId);
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      return {
        ...currentSettings,
        topics: moveListItem(currentSettings.topics, currentIndex, targetIndex)
      };
    });
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(finalEmail);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="glass-panel overflow-hidden rounded-[32px] px-6 pb-6 pt-4 sm:px-8 sm:pb-8 sm:pt-5 lg:px-10 lg:pb-10 lg:pt-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-[rgb(var(--page-foreground))] sm:text-5xl">
                Hyatt Email Template
              </h1>
            </div>

            <div className="flex flex-col gap-3 sm:min-w-[280px] sm:items-end">
              <div className="panel-shell rounded-[24px] px-5 py-4 text-sm text-[rgba(27,47,64,0.78)] sm:w-full">
                <div className="font-semibold text-[rgb(var(--page-foreground))]">{saveMessage}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[rgba(15,95,135,0.68)]">
                  {persistenceMode === 'database' ? 'Manual server persistence' : 'Manual local persistence'}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(true)}
                  className="rounded-full border border-[rgba(15,95,135,0.16)] bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--wine))] transition hover:-translate-y-0.5"
                >
                  Edit base email
                </button>
                <button
                  type="button"
                  onClick={() => setIsTopicsModalOpen(true)}
                  className="rounded-full border border-[rgba(15,95,135,0.16)] bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--wine))] transition hover:-translate-y-0.5"
                >
                  Edit topics
                </button>
                <button
                  type="button"
                  onClick={saveAllChanges}
                  disabled={!hasUnsavedChanges || isSaving || !isHydrated}
                  className="rounded-full bg-[rgb(var(--wine))] px-5 py-2.5 text-sm font-semibold text-white transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save all changes
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="template-grid">
          <section className="space-y-6 lg:order-1">
            <div className="glass-panel rounded-[28px] p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="section-label">Preview</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Final email</h2>
                </div>
                <button
                  type="button"
                  onClick={copyEmail}
                  className="rounded-full bg-[rgb(var(--wine))] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                >
                  {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy email'}
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-1">
                <div className="panel-shell rounded-[20px] p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(15,95,135,0.68)]">
                    Selected topics
                  </div>
                  <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[rgb(var(--page-foreground))]">
                    {selectedTopics.length}
                  </div>
                </div>
              </div>

              <Textarea
                ref={previewTextareaRef}
                readOnly
                value={finalEmail}
                className="mt-5 min-h-[760px] resize-none overflow-hidden rounded-[24px] border-[rgba(15,95,135,0.14)] bg-[rgba(255,255,252,0.92)] px-5 py-4 font-mono text-sm leading-7 text-[rgb(var(--page-foreground))] shadow-none focus:ring-0"
              />
            </div>
          </section>

          <aside className="space-y-6 lg:sticky lg:top-6 lg:order-2">
            <div className="glass-panel rounded-[28px] p-6 sm:p-8">
              <p className="section-label">Booking Details</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Fill preview fields</h2>
              <p className="mt-3 text-sm leading-6 text-[rgba(27,47,64,0.72)]">
                These values are inserted into the preview automatically through
                {' '}
                <span className="font-semibold text-[rgb(var(--page-foreground))]">{MANAGER_PLACEHOLDER}</span>
                {', '}
                <span className="font-semibold text-[rgb(var(--page-foreground))]">{HOTEL_PLACEHOLDER}</span>
                {' '}
                and
                {' '}
                <span className="font-semibold text-[rgb(var(--page-foreground))]">{CONFIRMATION_PLACEHOLDER}</span>.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(15,95,135,0.68)]">
                    Manager name
                  </label>
                  <Input
                    value={managerName}
                    onChange={(event) => setManagerName(event.target.value)}
                    className="rounded-[18px] border-[rgba(15,95,135,0.14)] bg-white px-4 py-3 text-sm shadow-none focus:ring-[rgba(15,95,135,0.3)]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(15,95,135,0.68)]">
                    Hotel
                  </label>
                  <Input
                    value={hotelName}
                    onChange={(event) => setHotelName(event.target.value)}
                    className="rounded-[18px] border-[rgba(15,95,135,0.14)] bg-white px-4 py-3 text-sm shadow-none focus:ring-[rgba(15,95,135,0.3)]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(15,95,135,0.68)]">
                    Confirmation number
                  </label>
                  <Input
                    value={confirmationNumber}
                    onChange={(event) => setConfirmationNumber(event.target.value)}
                    className="rounded-[18px] border-[rgba(15,95,135,0.14)] bg-white px-4 py-3 text-sm shadow-none focus:ring-[rgba(15,95,135,0.3)]"
                  />
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-[28px] p-6 sm:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="section-label">Selected Topics</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Arrange email order</h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAllTopics}
                    className="rounded-full border border-[rgba(15,95,135,0.16)] bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--wine))] transition hover:-translate-y-0.5"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={clearSelectedTopics}
                    className="rounded-full border border-[rgba(15,95,135,0.16)] bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--wine))] transition hover:-translate-y-0.5"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <p className="mt-3 text-sm leading-6 text-[rgba(27,47,64,0.72)]">
                Only selected topics appear here. Their order from top to bottom controls how the
                selected topic content appears in the final email.
              </p>

              <div className="mt-5 space-y-3">
                {selectedTopics.length > 0 ? (
                  selectedTopics.map((topic, index) => (
                    <article key={topic.id} className="panel-shell rounded-[22px] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 text-sm font-semibold text-[rgb(var(--page-foreground))]">
                            <span className="block truncate">{topic.title || 'Untitled topic'}</span>
                            <span className="mt-1 block text-xs font-normal uppercase tracking-[0.16em] text-[rgba(15,95,135,0.68)]">
                              Email position {index + 1}
                            </span>
                          </div>

                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => toggleTopic(topic.id)}
                              className="rounded-full border border-[rgba(145,69,41,0.16)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(145,69,41,0.86)] transition hover:bg-[rgba(145,69,41,0.06)]"
                            >
                              Remove
                            </button>
                            <button
                              type="button"
                              onClick={() => moveSelectedTopic(topic.id, 'up')}
                              disabled={index === 0}
                              className="rounded-full border border-[rgba(15,95,135,0.16)] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[rgb(var(--wine))] transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              onClick={() => moveSelectedTopic(topic.id, 'down')}
                              disabled={index === selectedTopics.length - 1}
                              className="rounded-full border border-[rgba(15,95,135,0.16)] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[rgb(var(--wine))] transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Down
                            </button>
                          </div>
                        </div>
                      </article>
                  ))
                ) : (
                  <div className="panel-shell rounded-[22px] p-4 text-sm text-[rgba(27,47,64,0.72)]">
                    No selected topics yet. Choose them in Edit topics.
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {selectedTopics.length > 0 ? (
                  selectedTopics.map((topic, index) => (
                    <span
                      key={topic.id}
                      className="rounded-full bg-[rgba(15,95,135,0.08)] px-3 py-1.5 text-sm font-semibold text-[rgb(var(--wine))]"
                    >
                      {index + 1}. {topic.title || 'Untitled topic'}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[rgba(27,47,64,0.66)]">No topics selected.</span>
                )}
              </div>
            </div>
          </aside>
        </div>

        {isTemplateModalOpen ? (
          <EditorModal
            title="Base email"
            description="Edit the reusable template in a popup. Use the placeholders below to control where booking details and selected topic content are inserted."
            onClose={() => setIsTemplateModalOpen(false)}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[rgba(15,95,135,0.08)] px-3 py-1.5 text-sm font-semibold text-[rgb(var(--wine))]">
                  {TOPICS_PLACEHOLDER}
                </span>
              </div>

              <button
                type="button"
                onClick={async () => {
                  const didSave = await saveTemplate();
                  if (didSave) {
                    setIsTemplateModalOpen(false);
                  }
                }}
                disabled={!templateIsDirty || isSaving || !isHydrated}
                className="rounded-full bg-[rgb(var(--wine))] px-5 py-2.5 text-sm font-semibold text-white transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save template
              </button>
            </div>

            <Textarea
              ref={baseEmailTextareaRef}
              value={settings.defaultTemplate}
              onChange={(event) =>
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  defaultTemplate: event.target.value
                }))
              }
              className="mt-5 min-h-[680px] resize-none overflow-hidden rounded-[24px] border-[rgba(15,95,135,0.14)] bg-[rgba(255,255,252,0.88)] px-5 py-4 text-base leading-7 text-[rgb(var(--page-foreground))] shadow-none focus:ring-[rgba(15,95,135,0.3)]"
            />

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                className="rounded-full border border-[rgba(15,95,135,0.16)] bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--wine))] transition hover:-translate-y-0.5"
              >
                Close
              </button>
            </div>
          </EditorModal>
        ) : null}

        {isTopicsModalOpen ? (
          <EditorModal
            title="Topics"
            description="Manage the topic library in a popup. The landing page controls the final email order for selected topics only."
            onClose={() => setIsTopicsModalOpen(false)}
          >
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={addTopic}
                className="rounded-full bg-[rgb(var(--wine))] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
              >
                Add topic
              </button>
              <button
                type="button"
                onClick={selectAllTopics}
                className="rounded-full border border-[rgba(15,95,135,0.16)] bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--wine))] transition hover:-translate-y-0.5"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={clearSelectedTopics}
                className="rounded-full border border-[rgba(15,95,135,0.16)] bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--wine))] transition hover:-translate-y-0.5"
              >
                Clear
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {settings.topics.length > 0 ? (
                settings.topics.map((topic, index) => {
                  const isSelected = settings.selectedTopicIds.includes(topic.id);

                  return (
                    <article
                      key={topic.id}
                      className={`panel-shell rounded-[26px] p-5 transition ${
                        isSelected ? 'soft-ring bg-[rgba(255,255,252,0.96)]' : ''
                      }`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <label className="flex items-center gap-3 text-sm font-semibold text-[rgb(var(--page-foreground))]">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTopic(topic.id)}
                            className="h-4 w-4 rounded border-[rgba(15,95,135,0.28)] text-[rgb(var(--wine))] focus:ring-[rgba(15,95,135,0.3)]"
                          />
                          Include this topic
                        </label>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => moveTopic(topic.id, 'up')}
                            disabled={index === 0}
                            className="rounded-full border border-[rgba(15,95,135,0.16)] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[rgb(var(--wine))] transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            onClick={() => moveTopic(topic.id, 'down')}
                            disabled={index === settings.topics.length - 1}
                            className="rounded-full border border-[rgba(15,95,135,0.16)] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[rgb(var(--wine))] transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Down
                          </button>
                          <button
                            type="button"
                            onClick={() => removeTopic(topic.id)}
                            className="rounded-full border border-[rgba(145,69,41,0.16)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(145,69,41,0.86)] transition hover:bg-[rgba(145,69,41,0.06)]"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4">
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(15,95,135,0.68)]">
                            Topic title {index + 1}
                          </label>
                          <Input
                            value={topic.title}
                            onChange={(event) => updateTopic(topic.id, 'title', event.target.value)}
                            placeholder="Example: Anniversary"
                            className="rounded-[18px] border-[rgba(15,95,135,0.14)] bg-white px-4 py-3 text-sm shadow-none focus:ring-[rgba(15,95,135,0.3)]"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(15,95,135,0.68)]">
                            Topic content
                          </label>
                          <Textarea
                            value={topic.content}
                            onChange={(event) => updateTopic(topic.id, 'content', event.target.value)}
                            placeholder="Write the sentence or paragraph that should be inserted when this topic is selected."
                            className="min-h-[140px] rounded-[18px] border-[rgba(15,95,135,0.14)] bg-white px-4 py-3 text-sm leading-6 shadow-none focus:ring-[rgba(15,95,135,0.3)]"
                          />
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="panel-shell rounded-[24px] p-5 text-sm text-[rgba(27,47,64,0.72)]">
                  No topics yet. Add a topic, give it a title and content, then tick it to include it
                  in the email.
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsTopicsModalOpen(false)}
                className="rounded-full border border-[rgba(15,95,135,0.16)] bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--wine))] transition hover:-translate-y-0.5"
              >
                Close
              </button>
              <button
                type="button"
                onClick={async () => {
                  const didSave = await saveTopics();
                  if (didSave) {
                    setIsTopicsModalOpen(false);
                  }
                }}
                disabled={!topicsAreDirty || isSaving || !isHydrated}
                className="rounded-full bg-[rgb(var(--wine))] px-5 py-2.5 text-sm font-semibold text-white transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save topics
              </button>
            </div>
          </EditorModal>
        ) : null}
      </div>
    </main>
  );
}