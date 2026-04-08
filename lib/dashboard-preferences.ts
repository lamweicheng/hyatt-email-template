import 'server-only';

import { ZodError } from 'zod';
import { getPrismaClient } from './prisma';
import { dashboardPreferencesPatchSchema, dashboardPreferencesSchema } from './validation';
import type {
  DashboardSectionId,
  DashboardPreferencesPatch,
  DashboardPreferencesRecord,
  DisplayPreferences,
  TopExperienceSlot,
  TopFutureStaySlot,
  TopPickSlot,
  TopReturnStaySlot,
  TopUnderratedSlot,
  TopSuiteSlot
} from './types';

const DASHBOARD_PREFERENCES_ID = 'default';

export const DEFAULT_TOP_PICKS: TopPickSlot[] = [
  { rank: 1, hotelId: '', imageUrl: '' },
  { rank: 2, hotelId: '', imageUrl: '' },
  { rank: 3, hotelId: '', imageUrl: '' }
];

export const DEFAULT_TOP_SUITES: TopSuiteSlot[] = [
  { rank: 1, hotelId: '', suiteName: '', imageUrl: '' },
  { rank: 2, hotelId: '', suiteName: '', imageUrl: '' },
  { rank: 3, hotelId: '', suiteName: '', imageUrl: '' }
];

export const DEFAULT_TOP_FUTURE_STAYS: TopFutureStaySlot[] = [
  { rank: 1, hotelId: '', location: '', imageUrl: '' },
  { rank: 2, hotelId: '', location: '', imageUrl: '' },
  { rank: 3, hotelId: '', location: '', imageUrl: '' }
];

export const DEFAULT_TOP_EXPERIENCES: TopExperienceSlot[] = [
  { rank: 1, hotelId: '', description: '', imageUrl: '' },
  { rank: 2, hotelId: '', description: '', imageUrl: '' },
  { rank: 3, hotelId: '', description: '', imageUrl: '' }
];

export const DEFAULT_TOP_UNDERRATED: TopUnderratedSlot[] = [
  { rank: 1, hotelId: '', imageUrl: '' },
  { rank: 2, hotelId: '', imageUrl: '' },
  { rank: 3, hotelId: '', imageUrl: '' }
];

export const DEFAULT_TOP_RETURN_STAYS: TopReturnStaySlot[] = [
  { rank: 1, hotelId: '', imageUrl: '' },
  { rank: 2, hotelId: '', imageUrl: '' },
  { rank: 3, hotelId: '', imageUrl: '' }
];

export const DEFAULT_SECTION_ORDER: DashboardSectionId[] = [
  'topHotels',
  'topSuites',
  'tierBoard',
  'futureHotels',
  'travelTimeline',
  'suiteSlideshow',
  'bucketListSlideshow',
  'kellyExplorations',
  'topFutureStays',
  'topExperiences',
  'topUnderrated',
  'topReturnStays'
];

export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  showTopHotels: true,
  showTopSuites: true,
  showTierBoard: true,
  showFutureHotels: true,
  showTravelTimeline: true,
  showSuiteSlideshow: true,
  showBucketListSlideshow: true,
  showKellyExplorations: true,
  showTopFutureStays: true,
  showTopExperiences: true,
  showTopUnderrated: true,
  showTopReturnStays: true,
  sectionOrder: DEFAULT_SECTION_ORDER
};

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferencesRecord = {
  topPicks: DEFAULT_TOP_PICKS,
  topSuites: DEFAULT_TOP_SUITES,
  topFutureStays: DEFAULT_TOP_FUTURE_STAYS,
  topExperiences: DEFAULT_TOP_EXPERIENCES,
  topUnderrated: DEFAULT_TOP_UNDERRATED,
  topReturnStays: DEFAULT_TOP_RETURN_STAYS,
  displayPreferences: DEFAULT_DISPLAY_PREFERENCES
};

type DashboardPreferencesDelegate = {
  findUnique: (args: { where: { id: string } }) => Promise<{
    topPicks: unknown;
    topSuites: unknown;
    topFutureStays: unknown;
    topExperiences: unknown;
    topUnderrated: unknown;
    topReturnStays: unknown;
    displayPreferences: unknown;
  } | null>;
  upsert: (args: {
    where: { id: string };
    create: {
      id: string;
      topPicks: TopPickSlot[];
      topSuites: TopSuiteSlot[];
      topFutureStays: TopFutureStaySlot[];
      topExperiences: TopExperienceSlot[];
      topUnderrated: TopUnderratedSlot[];
      topReturnStays: TopReturnStaySlot[];
      displayPreferences: DisplayPreferences;
    };
    update: {
      topPicks: TopPickSlot[];
      topSuites: TopSuiteSlot[];
      topFutureStays: TopFutureStaySlot[];
      topExperiences: TopExperienceSlot[];
      topUnderrated: TopUnderratedSlot[];
      topReturnStays: TopReturnStaySlot[];
      displayPreferences: DisplayPreferences;
    };
  }) => Promise<{
    topPicks: unknown;
    topSuites: unknown;
    topFutureStays: unknown;
    topExperiences: unknown;
    topUnderrated: unknown;
    topReturnStays: unknown;
    displayPreferences: unknown;
  }>;
};

type DashboardPreferencesRow = {
  topPicks: unknown;
  topSuites: unknown;
  topFutureStays: unknown;
  topExperiences: unknown;
  topUnderrated: unknown;
  topReturnStays: unknown;
  displayPreferences: unknown;
};

type DashboardPreferencesPrismaClient = {
  dashboardPreferences?: DashboardPreferencesDelegate;
  $queryRawUnsafe: <T = unknown>(query: string, ...values: unknown[]) => Promise<T[]>;
};

function getDashboardPreferencesPrismaClient() {
  return getPrismaClient() as unknown as DashboardPreferencesPrismaClient;
}

function isMissingDashboardPreferencesStorage(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('dashboardPreferences') ||
    error.message.includes('DashboardPreferences') ||
    error.message.includes('does not exist') ||
    error.message.includes('no such table') ||
    error.message.includes('relation')
  );
}

function fallbackTopPicks(value: unknown): TopPickSlot[] {
  if (!Array.isArray(value)) {
    return DEFAULT_TOP_PICKS;
  }

  const mapped = value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry) => ({
      rank: entry.rank === 1 || entry.rank === 2 || entry.rank === 3 ? entry.rank : null,
      hotelId: typeof entry.hotelId === 'string' ? entry.hotelId : '',
      imageUrl: typeof entry.imageUrl === 'string' ? entry.imageUrl : ''
    }))
    .filter((entry): entry is TopPickSlot => entry.rank !== null);

  return DEFAULT_TOP_PICKS.map(
    (slot) => mapped.find((entry) => entry.rank === slot.rank) ?? slot
  );
}

function fallbackTopSuites(value: unknown): TopSuiteSlot[] {
  if (!Array.isArray(value)) {
    return DEFAULT_TOP_SUITES;
  }

  const mapped = value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry) => ({
      rank: entry.rank === 1 || entry.rank === 2 || entry.rank === 3 ? entry.rank : null,
      hotelId: typeof entry.hotelId === 'string' ? entry.hotelId : '',
      suiteName: typeof entry.suiteName === 'string' ? entry.suiteName : '',
      imageUrl: typeof entry.imageUrl === 'string' ? entry.imageUrl : ''
    }))
    .filter((entry): entry is TopSuiteSlot => entry.rank !== null);

  return DEFAULT_TOP_SUITES.map(
    (slot) => mapped.find((entry) => entry.rank === slot.rank) ?? slot
  );
}

function fallbackTopFutureStays(value: unknown): TopFutureStaySlot[] {
  if (!Array.isArray(value)) {
    return DEFAULT_TOP_FUTURE_STAYS;
  }

  const mapped = value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry) => ({
      rank: entry.rank === 1 || entry.rank === 2 || entry.rank === 3 ? entry.rank : null,
      hotelId: typeof entry.hotelId === 'string' ? entry.hotelId : '',
      location: typeof entry.location === 'string' ? entry.location : '',
      imageUrl: typeof entry.imageUrl === 'string' ? entry.imageUrl : ''
    }))
    .filter((entry): entry is TopFutureStaySlot => entry.rank !== null);

  return DEFAULT_TOP_FUTURE_STAYS.map(
    (slot) => mapped.find((entry) => entry.rank === slot.rank) ?? slot
  );
}

function fallbackTopExperiences(value: unknown): TopExperienceSlot[] {
  if (!Array.isArray(value)) {
    return DEFAULT_TOP_EXPERIENCES;
  }

  const mapped = value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry) => ({
      rank: entry.rank === 1 || entry.rank === 2 || entry.rank === 3 ? entry.rank : null,
      hotelId: typeof entry.hotelId === 'string' ? entry.hotelId : '',
      description: typeof entry.description === 'string' ? entry.description : '',
      imageUrl: typeof entry.imageUrl === 'string' ? entry.imageUrl : ''
    }))
    .filter((entry): entry is TopExperienceSlot => entry.rank !== null);

  return DEFAULT_TOP_EXPERIENCES.map(
    (slot) => mapped.find((entry) => entry.rank === slot.rank) ?? slot
  );
}

function fallbackTopUnderrated(value: unknown): TopUnderratedSlot[] {
  if (!Array.isArray(value)) {
    return DEFAULT_TOP_UNDERRATED;
  }

  const mapped = value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry) => ({
      rank: entry.rank === 1 || entry.rank === 2 || entry.rank === 3 ? entry.rank : null,
      hotelId: typeof entry.hotelId === 'string' ? entry.hotelId : '',
      imageUrl: typeof entry.imageUrl === 'string' ? entry.imageUrl : ''
    }))
    .filter((entry): entry is TopUnderratedSlot => entry.rank !== null);

  return DEFAULT_TOP_UNDERRATED.map(
    (slot) => mapped.find((entry) => entry.rank === slot.rank) ?? slot
  );
}

function fallbackTopReturnStays(value: unknown): TopReturnStaySlot[] {
  if (!Array.isArray(value)) {
    return DEFAULT_TOP_RETURN_STAYS;
  }

  const mapped = value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry) => ({
      rank: entry.rank === 1 || entry.rank === 2 || entry.rank === 3 ? entry.rank : null,
      hotelId: typeof entry.hotelId === 'string' ? entry.hotelId : '',
      imageUrl: typeof entry.imageUrl === 'string' ? entry.imageUrl : ''
    }))
    .filter((entry): entry is TopReturnStaySlot => entry.rank !== null);

  return DEFAULT_TOP_RETURN_STAYS.map(
    (slot) => mapped.find((entry) => entry.rank === slot.rank) ?? slot
  );
}

function fallbackDisplayPreferences(value: unknown): DisplayPreferences {
  if (typeof value !== 'object' || value === null) {
    return DEFAULT_DISPLAY_PREFERENCES;
  }

  const record = value as Record<string, unknown>;
  const sectionOrder = Array.isArray(record.sectionOrder)
    ? record.sectionOrder.filter(
        (entry): entry is DashboardSectionId =>
          typeof entry === 'string' && DEFAULT_SECTION_ORDER.includes(entry as DashboardSectionId)
      )
    : [];
  const mergedSectionOrder = [
    ...sectionOrder,
    ...DEFAULT_SECTION_ORDER.filter((sectionId) => !sectionOrder.includes(sectionId))
  ];

  return {
    showTopHotels:
      typeof record.showTopHotels === 'boolean'
        ? record.showTopHotels
        : DEFAULT_DISPLAY_PREFERENCES.showTopHotels,
    showTopSuites:
      typeof record.showTopSuites === 'boolean'
        ? record.showTopSuites
        : DEFAULT_DISPLAY_PREFERENCES.showTopSuites,
    showTierBoard:
      typeof record.showTierBoard === 'boolean'
        ? record.showTierBoard
        : DEFAULT_DISPLAY_PREFERENCES.showTierBoard,
    showFutureHotels:
      typeof record.showFutureHotels === 'boolean'
        ? record.showFutureHotels
        : DEFAULT_DISPLAY_PREFERENCES.showFutureHotels,
    showTravelTimeline:
      typeof record.showTravelTimeline === 'boolean'
        ? record.showTravelTimeline
        : DEFAULT_DISPLAY_PREFERENCES.showTravelTimeline,
    showSuiteSlideshow:
      typeof record.showSuiteSlideshow === 'boolean'
        ? record.showSuiteSlideshow
        : DEFAULT_DISPLAY_PREFERENCES.showSuiteSlideshow,
    showBucketListSlideshow:
      typeof record.showBucketListSlideshow === 'boolean'
        ? record.showBucketListSlideshow
        : DEFAULT_DISPLAY_PREFERENCES.showBucketListSlideshow,
    showKellyExplorations:
      typeof record.showKellyExplorations === 'boolean'
        ? record.showKellyExplorations
        : DEFAULT_DISPLAY_PREFERENCES.showKellyExplorations,
    showTopFutureStays:
      typeof record.showTopFutureStays === 'boolean'
        ? record.showTopFutureStays
        : DEFAULT_DISPLAY_PREFERENCES.showTopFutureStays,
    showTopExperiences:
      typeof record.showTopExperiences === 'boolean'
        ? record.showTopExperiences
        : DEFAULT_DISPLAY_PREFERENCES.showTopExperiences,
    showTopUnderrated:
      typeof record.showTopUnderrated === 'boolean'
        ? record.showTopUnderrated
        : DEFAULT_DISPLAY_PREFERENCES.showTopUnderrated,
    showTopReturnStays:
      typeof record.showTopReturnStays === 'boolean'
        ? record.showTopReturnStays
        : DEFAULT_DISPLAY_PREFERENCES.showTopReturnStays,
    sectionOrder: mergedSectionOrder
  };
}

export function normalizeDashboardPreferences(value: unknown): DashboardPreferencesRecord {
  if (typeof value !== 'object' || value === null) {
    return DEFAULT_DASHBOARD_PREFERENCES;
  }

  const record = value as Record<string, unknown>;

  return {
    topPicks: fallbackTopPicks(record.topPicks),
    topSuites: fallbackTopSuites(record.topSuites),
    topFutureStays: fallbackTopFutureStays(record.topFutureStays),
    topExperiences: fallbackTopExperiences(record.topExperiences),
    topUnderrated: fallbackTopUnderrated(record.topUnderrated),
    topReturnStays: fallbackTopReturnStays(record.topReturnStays),
    displayPreferences: fallbackDisplayPreferences(record.displayPreferences)
  };
}

export async function listDashboardPreferences() {
  if (!process.env.DATABASE_URL) {
    return DEFAULT_DASHBOARD_PREFERENCES;
  }

  const prisma = getDashboardPreferencesPrismaClient();
  const delegate = prisma.dashboardPreferences ?? null;

  try {
    const preferences = delegate
      ? await delegate.findUnique({
          where: { id: DASHBOARD_PREFERENCES_ID }
        })
      : (
          await prisma.$queryRawUnsafe<DashboardPreferencesRow>(
            'SELECT "topPicks", "topSuites", "topFutureStays", "topExperiences", "topUnderrated", "topReturnStays", "displayPreferences" FROM "DashboardPreferences" WHERE "id" = $1 LIMIT 1',
            DASHBOARD_PREFERENCES_ID
          )
        )[0] ?? null;

    if (!preferences) {
      return DEFAULT_DASHBOARD_PREFERENCES;
    }

    return normalizeDashboardPreferences({
      topPicks: preferences.topPicks,
      topSuites: preferences.topSuites,
      topFutureStays: preferences.topFutureStays,
      topExperiences: preferences.topExperiences,
      topUnderrated: preferences.topUnderrated,
      topReturnStays: preferences.topReturnStays,
      displayPreferences: preferences.displayPreferences
    });
  } catch (error) {
    if (isMissingDashboardPreferencesStorage(error)) {
      return DEFAULT_DASHBOARD_PREFERENCES;
    }

    throw error;
  }
}

export async function saveDashboardPreferences(payload: DashboardPreferencesPatch | DashboardPreferencesRecord) {
  const patch = dashboardPreferencesPatchSchema.parse(payload);
  const currentPreferences = await listDashboardPreferences();
  const data = dashboardPreferencesSchema.parse({
    topPicks: patch.topPicks ?? currentPreferences.topPicks,
    topSuites: patch.topSuites ?? currentPreferences.topSuites,
    topFutureStays: patch.topFutureStays ?? currentPreferences.topFutureStays,
    topExperiences: patch.topExperiences ?? currentPreferences.topExperiences,
    topUnderrated: patch.topUnderrated ?? currentPreferences.topUnderrated,
    topReturnStays: patch.topReturnStays ?? currentPreferences.topReturnStays,
    displayPreferences: patch.displayPreferences ?? currentPreferences.displayPreferences
  });

  const prisma = getDashboardPreferencesPrismaClient();
  const delegate = prisma.dashboardPreferences ?? null;

  try {
    const preferences = delegate
      ? await delegate.upsert({
          where: { id: DASHBOARD_PREFERENCES_ID },
          create: {
            id: DASHBOARD_PREFERENCES_ID,
            topPicks: data.topPicks,
            topSuites: data.topSuites,
            topFutureStays: data.topFutureStays,
            topExperiences: data.topExperiences,
            topUnderrated: data.topUnderrated,
            topReturnStays: data.topReturnStays,
            displayPreferences: data.displayPreferences
          },
          update: {
            topPicks: data.topPicks,
            topSuites: data.topSuites,
            topFutureStays: data.topFutureStays,
            topExperiences: data.topExperiences,
            topUnderrated: data.topUnderrated,
            topReturnStays: data.topReturnStays,
            displayPreferences: data.displayPreferences
          }
        })
      : (
          await prisma.$queryRawUnsafe<DashboardPreferencesRow>(
            'INSERT INTO "DashboardPreferences" ("id", "topPicks", "topSuites", "topFutureStays", "topExperiences", "topUnderrated", "topReturnStays", "displayPreferences", "createdAt", "updatedAt") VALUES ($1, CAST($2 AS jsonb), CAST($3 AS jsonb), CAST($4 AS jsonb), CAST($5 AS jsonb), CAST($6 AS jsonb), CAST($7 AS jsonb), CAST($8 AS jsonb), NOW(), NOW()) ON CONFLICT ("id") DO UPDATE SET "topPicks" = CAST($2 AS jsonb), "topSuites" = CAST($3 AS jsonb), "topFutureStays" = CAST($4 AS jsonb), "topExperiences" = CAST($5 AS jsonb), "topUnderrated" = CAST($6 AS jsonb), "topReturnStays" = CAST($7 AS jsonb), "displayPreferences" = CAST($8 AS jsonb), "updatedAt" = NOW() RETURNING "topPicks", "topSuites", "topFutureStays", "topExperiences", "topUnderrated", "topReturnStays", "displayPreferences"',
            DASHBOARD_PREFERENCES_ID,
            JSON.stringify(data.topPicks),
            JSON.stringify(data.topSuites),
            JSON.stringify(data.topFutureStays),
            JSON.stringify(data.topExperiences),
            JSON.stringify(data.topUnderrated),
            JSON.stringify(data.topReturnStays),
            JSON.stringify(data.displayPreferences)
          )
        )[0];

    return normalizeDashboardPreferences({
      topPicks: preferences.topPicks,
      topSuites: preferences.topSuites,
      topFutureStays: preferences.topFutureStays,
      topExperiences: preferences.topExperiences,
      topUnderrated: preferences.topUnderrated,
      topReturnStays: preferences.topReturnStays,
      displayPreferences: preferences.displayPreferences
    });
  } catch (error) {
    if (isMissingDashboardPreferencesStorage(error)) {
      throw new Error('Dashboard preferences storage is not ready. Run Prisma generate and apply the migration.');
    }

    throw error;
  }
}

export function normalizeDashboardPreferencesError(error: unknown) {
  if (error instanceof ZodError) {
    return {
      status: 400,
      message: error.issues[0]?.message || 'Invalid dashboard preferences payload.'
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