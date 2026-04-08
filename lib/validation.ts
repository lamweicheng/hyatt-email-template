import { z } from 'zod';
import { HYATT_BRANDS, TIERS } from './hyatt-data';

const BRAND_NAMES = HYATT_BRANDS.map((brand) => brand.name) as [string, ...string[]];
const STAY_TYPES = ['EXPLORED', 'FUTURE', 'BUCKET_LIST'] as const;
const ROOM_ENTRY_KINDS = ['ROOM', 'SUITE'] as const;

const stayEntrySchema = z.object({
  id: z.string().trim().min(1).optional(),
  month: z.number().int().min(1, 'Month is required').max(12, 'Month must be between 1 and 12'),
  year: z.number().int().min(1900, 'Year must be 1900 or later').max(2100, 'Year must be 2100 or earlier'),
  withKelly: z.boolean().default(false)
});

const roomEntrySchema = z.object({
  label: z.string().trim().min(1, 'Room type is required').max(80, 'Max 80 characters'),
  kind: z.enum(ROOM_ENTRY_KINDS),
  imageUrl: z.string().default(''),
  stars: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.null()]).default(null),
  withKelly: z.boolean().default(false)
});

export const hotelFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Hotel name is required').max(120, 'Max 120 characters'),
    brand: z.enum(BRAND_NAMES, {
      errorMap: () => ({ message: 'Choose a Hyatt brand' })
    }),
    stayType: z.enum(STAY_TYPES),
    tier: z.enum(TIERS).nullable(),
    roomEntries: z.array(roomEntrySchema).default([]),
    stayEntries: z.array(stayEntrySchema).default([]),
    bucketListLocation: z.string().trim().max(120, 'Max 120 characters').default(''),
    bucketListImageUrl: z.string().trim().max(2048, 'Max 2048 characters').default('')
  })
  .superRefine((value, ctx) => {
    if (value.stayType === 'EXPLORED' && !value.tier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tier'],
        message: 'Select a tier'
      });
    }

    if (value.stayType === 'FUTURE' && value.stayEntries.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stayEntries'],
        message: 'Add at least one planned month and year'
      });
    }

    if (value.stayType === 'BUCKET_LIST' && !value.bucketListLocation.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bucketListLocation'],
        message: 'Add a location for this bucket-list hotel'
      });
    }

    if (value.stayType === 'BUCKET_LIST' && !value.bucketListImageUrl.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bucketListImageUrl'],
        message: 'Add a photo URL for this bucket-list hotel'
      });
    }
  })
  .transform((value) => ({
    ...value,
    roomEntries: value.roomEntries.map((entry) => ({
      label: entry.label.trim(),
      kind: entry.kind,
      imageUrl: entry.kind === 'SUITE' ? entry.imageUrl.trim() : '',
      stars: entry.kind === 'SUITE' ? entry.stars : null,
      withKelly: entry.kind === 'SUITE' ? entry.withKelly : false
    })),
    stayEntries: value.stayEntries.map((entry) => ({
      id: entry.id?.trim() || crypto.randomUUID(),
      month: entry.month,
      year: entry.year,
      withKelly: entry.withKelly
    })),
    bucketListLocation: value.stayType === 'BUCKET_LIST' ? value.bucketListLocation.trim() : '',
    bucketListImageUrl: value.stayType === 'BUCKET_LIST' ? value.bucketListImageUrl.trim() : ''
  }));

export type HotelFormPayload = z.infer<typeof hotelFormSchema>;

export const hotelReorderSchema = z.object({
  hotels: z.array(
    z.object({
      id: z.string().min(1),
      stayType: z.enum(STAY_TYPES),
      tier: z.enum(TIERS).nullable(),
      position: z.number().int().min(0)
    })
  )
});

export type HotelReorderPayload = z.infer<typeof hotelReorderSchema>;

const topPickRankSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const topPickSlotSchema = z.object({
  rank: topPickRankSchema,
  hotelId: z.string(),
  imageUrl: z.string()
});

const topSuiteSlotSchema = z.object({
  rank: topPickRankSchema,
  hotelId: z.string(),
  suiteName: z.string(),
  imageUrl: z.string()
});

const topFutureStaySlotSchema = z.object({
  rank: topPickRankSchema,
  hotelId: z.string(),
  location: z.string(),
  imageUrl: z.string()
});

const topExperienceSlotSchema = z.object({
  rank: topPickRankSchema,
  hotelId: z.string(),
  description: z.string(),
  imageUrl: z.string()
});

const topUnderratedSlotSchema = z.object({
  rank: topPickRankSchema,
  hotelId: z.string(),
  imageUrl: z.string()
});

const topReturnStaySlotSchema = z.object({
  rank: topPickRankSchema,
  hotelId: z.string(),
  imageUrl: z.string()
});

const dashboardSectionIdSchema = z.union([
  z.literal('topHotels'),
  z.literal('topSuites'),
  z.literal('tierBoard'),
  z.literal('futureHotels'),
  z.literal('travelTimeline'),
  z.literal('suiteSlideshow'),
  z.literal('bucketListSlideshow'),
  z.literal('kellyExplorations'),
  z.literal('topFutureStays'),
  z.literal('topExperiences'),
  z.literal('topUnderrated'),
  z.literal('topReturnStays')
]);

const displayPreferencesSchema = z.object({
  showTopHotels: z.boolean(),
  showTopSuites: z.boolean(),
  showTierBoard: z.boolean(),
  showFutureHotels: z.boolean(),
  showTravelTimeline: z.boolean(),
  showSuiteSlideshow: z.boolean(),
  showBucketListSlideshow: z.boolean(),
  showKellyExplorations: z.boolean(),
  showTopFutureStays: z.boolean(),
  showTopExperiences: z.boolean(),
  showTopUnderrated: z.boolean(),
  showTopReturnStays: z.boolean(),
  sectionOrder: z.array(dashboardSectionIdSchema).length(12)
});

export const dashboardPreferencesSchema = z.object({
  topPicks: z.array(topPickSlotSchema).length(3),
  topSuites: z.array(topSuiteSlotSchema).length(3),
  topFutureStays: z.array(topFutureStaySlotSchema).length(3),
  topExperiences: z.array(topExperienceSlotSchema).length(3),
  topUnderrated: z.array(topUnderratedSlotSchema).length(3),
  topReturnStays: z.array(topReturnStaySlotSchema).length(3),
  displayPreferences: displayPreferencesSchema
});

export const dashboardPreferencesPatchSchema = dashboardPreferencesSchema.partial();

export type DashboardPreferencesPayload = z.infer<typeof dashboardPreferencesSchema>;
export type DashboardPreferencesPatchPayload = z.infer<typeof dashboardPreferencesPatchSchema>;