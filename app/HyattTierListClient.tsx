'use client';

import Image from 'next/image';
import { FormEvent, startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { BRAND_BY_NAME, BRANDS_BY_SEGMENT, HYATT_BRANDS, TIERS, sortHotelsByTier } from '@/lib/hyatt-data';
import { FancySelect } from '@/components/ui/fancy-select';
import { DashboardMenuModal, type DashboardMenuSection } from '@/components/DashboardMenuModal';
import type {
  DashboardSectionId,
  DashboardPreferencesPatch,
  DashboardPreferencesRecord,
  DisplayPreferences,
  HotelDraft,
  HotelRecord,
  PersistenceMode,
  RoomEntry,
  RoomEntryKind,
  StayEntry,
  StayType,
  Tier,
  TopExperienceSlot,
  TopFutureStaySlot,
  TopPickRank,
  TopPickSlot,
  TopReturnStaySlot,
  TopUnderratedSlot,
  TopSuiteSlot
} from '@/lib/types';

const LOCAL_STORAGE_KEY = 'hyatt-tier-list.hotels';
const TOP_PICKS_STORAGE_KEY = 'hyatt-tier-list.top-picks';
const TOP_SUITES_STORAGE_KEY = 'hyatt-tier-list.top-suites';
const TOP_FUTURE_STAYS_STORAGE_KEY = 'hyatt-tier-list.top-future-stays';
const TOP_EXPERIENCES_STORAGE_KEY = 'hyatt-tier-list.top-experiences';
const TOP_UNDERRATED_STORAGE_KEY = 'hyatt-tier-list.top-underrated';
const TOP_RETURN_STAYS_STORAGE_KEY = 'hyatt-tier-list.top-return-stays';
const DISPLAY_PREFERENCES_STORAGE_KEY = 'hyatt-tier-list.display-preferences';
const ALL_BUCKET_LIST_BRANDS = '__ALL_BUCKET_LIST_BRANDS__';

const DEFAULT_DRAFT: HotelDraft = {
  name: '',
  brand: HYATT_BRANDS[0].name,
  stayType: 'EXPLORED',
  tier: 'S',
  roomEntries: [],
  stayEntries: [],
  bucketListLocation: '',
  bucketListImageUrl: ''
};

const EMPTY_ROOM_ENTRY: RoomEntry = {
  label: '',
  kind: 'SUITE',
  imageUrl: '',
  stars: null,
  withKelly: false
};

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
] as const;

const EMPTY_STAY_ENTRY: StayEntry = {
  id: crypto.randomUUID(),
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  withKelly: false
};

const ROOM_KIND_OPTIONS: Array<{ value: RoomEntryKind; label: string }> = [
  { value: 'ROOM', label: 'Room' },
  { value: 'SUITE', label: 'Suite' }
];

const STAY_TYPE_OPTIONS: Array<{ value: StayType; label: string }> = [
  { value: 'EXPLORED', label: 'Explored' },
  { value: 'FUTURE', label: 'Future' },
  { value: 'BUCKET_LIST', label: 'Bucket List' }
];

const MONTH_OPTIONS = MONTH_LABELS.map((label, index) => ({
  value: String(index + 1),
  label
}));

const CURRENT_MONTH_INDEX = new Date().getFullYear() * 12 + new Date().getMonth();

const TIER_STYLES: Record<
  Tier,
  {
    panel: string;
    badge: string;
    empty: string;
  }
> = {
  S: {
    panel: 'from-[#7a1f2c]/14 via-[#f6e6d3] to-white',
    badge: 'bg-[#7a1f2c] text-white',
    empty: 'Nothing in S-tier yet.'
  },
  A: {
    panel: 'from-[#b47036]/14 via-[#f7ecdd] to-white',
    badge: 'bg-[#b47036] text-white',
    empty: 'No A-tier entries yet.'
  },
  B: {
    panel: 'from-[#4c7a68]/14 via-[#eff4ef] to-white',
    badge: 'bg-[#4c7a68] text-white',
    empty: 'No B-tier entries yet.'
  },
  C: {
    panel: 'from-[#5a6d8f]/14 via-[#eef2f7] to-white',
    badge: 'bg-[#5a6d8f] text-white',
    empty: 'No C-tier entries yet.'
  },
  D: {
    panel: 'from-[#6a5358]/14 via-[#f3eef0] to-white',
    badge: 'bg-[#6a5358] text-white',
    empty: 'No D-tier entries yet.'
  }
};

type ModalState =
  | {
      mode: 'create';
    }
  | {
      mode: 'edit';
      hotelId: string;
    }
  | null;

type DropTargetState = {
  stayType: StayType;
  tier: Tier | null;
  beforeHotelId: string | null;
} | null;

type DropTarget = {
  stayType: StayType;
  tier: Tier | null;
  beforeHotelId: string | null;
};

type BrandVisualStyle = {
  borderColor: string;
  background: string;
  labelColor: string;
  dotColor: string;
  shadowColor: string;
};

type TopOverviewItem = {
  rank: TopPickRank;
  hotel: HotelRecord;
  imageUrl: string;
  title: string;
  imageLabel?: string;
};

type TopOverviewSection = {
  id: string;
  label: string;
  title: string;
  emptyMessage: string;
  items: TopOverviewItem[];
};

type LoggedSuiteEntry = {
  id: string;
  suiteName: string;
  imageUrl: string;
  stars: 1 | 2 | 3 | 4 | 5 | null;
  hotel: HotelRecord;
};

type BucketListSlide = {
  id: string;
  imageUrl: string;
  location: string;
  hotel: HotelRecord;
};

const DEFAULT_TOP_PICKS: TopPickSlot[] = [
  { rank: 1, hotelId: '', imageUrl: '' },
  { rank: 2, hotelId: '', imageUrl: '' },
  { rank: 3, hotelId: '', imageUrl: '' }
];

const DEFAULT_TOP_SUITES: TopSuiteSlot[] = [
  { rank: 1, hotelId: '', suiteName: '', imageUrl: '' },
  { rank: 2, hotelId: '', suiteName: '', imageUrl: '' },
  { rank: 3, hotelId: '', suiteName: '', imageUrl: '' }
];

const DEFAULT_TOP_FUTURE_STAYS: TopFutureStaySlot[] = [
  { rank: 1, hotelId: '', location: '', imageUrl: '' },
  { rank: 2, hotelId: '', location: '', imageUrl: '' },
  { rank: 3, hotelId: '', location: '', imageUrl: '' }
];

const DEFAULT_TOP_EXPERIENCES: TopExperienceSlot[] = [
  { rank: 1, hotelId: '', description: '', imageUrl: '' },
  { rank: 2, hotelId: '', description: '', imageUrl: '' },
  { rank: 3, hotelId: '', description: '', imageUrl: '' }
];

const DEFAULT_TOP_UNDERRATED: TopUnderratedSlot[] = [
  { rank: 1, hotelId: '', imageUrl: '' },
  { rank: 2, hotelId: '', imageUrl: '' },
  { rank: 3, hotelId: '', imageUrl: '' }
];

const DEFAULT_TOP_RETURN_STAYS: TopReturnStaySlot[] = [
  { rank: 1, hotelId: '', imageUrl: '' },
  { rank: 2, hotelId: '', imageUrl: '' },
  { rank: 3, hotelId: '', imageUrl: '' }
];

const DEFAULT_SECTION_ORDER: DashboardSectionId[] = [
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

const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
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

type UserPhotoProps = {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
};

function UserPhoto({ src, alt, className, eager = false }: UserPhotoProps) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      sizes="100vw"
      loading={eager ? 'eager' : 'lazy'}
      referrerPolicy="no-referrer"
      draggable={false}
      className={className}
    />
  );
}

function isTier(value: unknown): value is Tier {
  return TIERS.includes(value as Tier);
}

function normalizeRoomEntries(value: unknown): RoomEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map<RoomEntry>((entry) => ({
      label: typeof entry.label === 'string' ? entry.label : '',
      kind: entry.kind === 'SUITE' ? 'SUITE' : 'ROOM',
      imageUrl: typeof entry.imageUrl === 'string' ? entry.imageUrl : '',
      stars:
        entry.stars === 1 || entry.stars === 2 || entry.stars === 3 || entry.stars === 4 || entry.stars === 5
          ? entry.stars
          : null,
      withKelly: typeof entry.withKelly === 'boolean' ? entry.withKelly : false
    }))
    .filter((entry) => entry.label.trim().length > 0);
}

function normalizeStayEntries(value: unknown): StayEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map<StayEntry | null>((entry) => {
      const month = typeof entry.month === 'number' ? entry.month : Number(entry.month);
      const year = typeof entry.year === 'number' ? entry.year : Number(entry.year);

      if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 1900) {
        return null;
      }

      return {
        id: typeof entry.id === 'string' && entry.id ? entry.id : crypto.randomUUID(),
        month,
        year,
        withKelly: typeof entry.withKelly === 'boolean' ? entry.withKelly : false
      };
    })
    .filter((entry): entry is StayEntry => entry !== null)
    .sort((left, right) => right.year - left.year || right.month - left.month);
}

function compareStayEntriesAscending(left: StayEntry, right: StayEntry) {
  return left.year - right.year || left.month - right.month;
}

function getMonthIndex(entry: StayEntry) {
  return entry.year * 12 + (entry.month - 1);
}

function getPrimaryFutureStayEntry(hotel: HotelRecord) {
  const sortedEntries = [...hotel.stayEntries].sort(compareStayEntriesAscending);
  return sortedEntries.find((entry) => getMonthIndex(entry) >= CURRENT_MONTH_INDEX) ?? sortedEntries[0] ?? null;
}

function sortFutureHotelsByPlannedDate(hotels: HotelRecord[]) {
  return [...hotels].sort((left, right) => {
    const leftEntry = getPrimaryFutureStayEntry(left);
    const rightEntry = getPrimaryFutureStayEntry(right);

    if (leftEntry && rightEntry) {
      const byPlannedDate = compareStayEntriesAscending(leftEntry, rightEntry);

      if (byPlannedDate !== 0) {
        return byPlannedDate;
      }
    } else if (leftEntry) {
      return -1;
    } else if (rightEntry) {
      return 1;
    }

    const byName = left.name.localeCompare(right.name);

    if (byName !== 0) {
      return byName;
    }

    return left.brand.localeCompare(right.brand);
  });
}

function formatMonthYear(entry: StayEntry | null) {
  if (!entry) {
    return 'Date TBD';
  }

  return `${MONTH_LABELS[entry.month - 1]} ${entry.year}`;
}

function normalizeHotelRecord(value: unknown): HotelRecord {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const stayType: StayType =
    raw.stayType === 'FUTURE'
      ? 'FUTURE'
      : raw.stayType === 'BUCKET_LIST'
        ? 'BUCKET_LIST'
        : 'EXPLORED';
  const tier = stayType === 'EXPLORED' && isTier(raw.tier) ? raw.tier : null;
  const timestamp = new Date().toISOString();

  return {
    id: typeof raw.id === 'string' ? raw.id : crypto.randomUUID(),
    name: typeof raw.name === 'string' ? raw.name : '',
    brand:
      typeof raw.brand === 'string' && BRAND_BY_NAME[raw.brand]
        ? raw.brand
        : HYATT_BRANDS[0].name,
    stayType,
    tier,
    roomEntries: normalizeRoomEntries(raw.roomEntries),
    stayEntries: normalizeStayEntries(raw.stayEntries),
    bucketListLocation: typeof raw.bucketListLocation === 'string' ? raw.bucketListLocation : '',
    bucketListImageUrl: typeof raw.bucketListImageUrl === 'string' ? raw.bucketListImageUrl : '',
    position: typeof raw.position === 'number' && Number.isInteger(raw.position) ? raw.position : 0,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : timestamp,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : timestamp
  };
}

function normalizeHotelCollection(hotels: HotelRecord[]) {
  const normalizedHotels = hotels.map(normalizeHotelRecord);
  const explored = TIERS.flatMap((tier) =>
    sortHotelsByTier(
      normalizedHotels.filter((hotel) => hotel.stayType === 'EXPLORED' && hotel.tier === tier)
    ).map((hotel, index) => ({
      ...hotel,
      tier,
      position: index
    }))
  );

  const future = sortHotelsByTier(
    normalizedHotels.filter((hotel) => hotel.stayType === 'FUTURE')
  ).map((hotel, index) => ({
    ...hotel,
    tier: null,
    position: index,
    roomEntries: hotel.roomEntries
  }));

  const bucketList = sortHotelsByTier(
    normalizedHotels.filter((hotel) => hotel.stayType === 'BUCKET_LIST')
  ).map((hotel, index) => ({
    ...hotel,
    tier: null,
    position: index,
    roomEntries: [],
    stayEntries: []
  }));

  return sortHotelsByTier([...explored, ...future, ...bucketList]);
}

function createLocalHotel(payload: HotelDraft): HotelRecord {
  const timestamp = new Date().toISOString();

  return normalizeHotelRecord({
    id: crypto.randomUUID(),
    ...payload,
    createdAt: timestamp,
    updatedAt: timestamp,
    position: 0
  });
}

function moveHotelInCollection(
  hotels: HotelRecord[],
  hotelId: string,
  stayType: StayType,
  tier: Tier | null,
  beforeHotelId: string | null
) {
  const draggedHotel = hotels.find((hotel) => hotel.id === hotelId);

  if (!draggedHotel) {
    return hotels;
  }

  if (stayType === 'EXPLORED' && !tier) {
    return hotels;
  }

  if (stayType === 'FUTURE' && draggedHotel.stayType !== 'FUTURE') {
    return hotels;
  }

  const normalizedTier = stayType === 'FUTURE' ? null : tier;

  if (
    beforeHotelId === hotelId &&
    draggedHotel.stayType === stayType &&
    draggedHotel.tier === normalizedTier
  ) {
    return hotels;
  }

  const remainingHotels = hotels.filter((hotel) => hotel.id !== hotelId);
  const targetGroupHotels = remainingHotels.filter(
    (hotel) => hotel.stayType === stayType && hotel.tier === normalizedTier
  );
  const otherHotels = remainingHotels.filter(
    (hotel) => !(hotel.stayType === stayType && hotel.tier === normalizedTier)
  );

  const updatedDraggedHotel = normalizeHotelRecord({
    ...draggedHotel,
    stayType,
    tier: normalizedTier,
    roomEntries: draggedHotel.roomEntries
  });

  const nextTargetGroup = [...targetGroupHotels];
  const insertIndex = beforeHotelId
    ? nextTargetGroup.findIndex((hotel) => hotel.id === beforeHotelId)
    : -1;

  if (insertIndex >= 0) {
    nextTargetGroup.splice(insertIndex, 0, updatedDraggedHotel);
  } else {
    nextTargetGroup.push(updatedDraggedHotel);
  }

  return normalizeHotelCollection([...otherHotels, ...nextTargetGroup]);
}

function resolveDropTargetFromPointer(
  event: React.DragEvent<HTMLElement>,
  stayType: StayType,
  tier: Tier | null
): DropTarget {
  const scope = event.currentTarget as HTMLElement;
  const hotelCards = Array.from(scope.querySelectorAll<HTMLElement>('[data-hotel-id]'));

  const sortedCards = hotelCards.sort((left, right) => {
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();

    if (Math.abs(leftRect.top - rightRect.top) > 8) {
      return leftRect.top - rightRect.top;
    }

    return leftRect.left - rightRect.left;
  });

  const hotelCard =
    sortedCards.find((card) => {
      const rect = card.getBoundingClientRect();
      const pointerAboveMidpoint = event.clientY < rect.top + rect.height / 2;
      const sameRow = Math.abs(event.clientY - (rect.top + rect.height / 2)) <= rect.height / 1.5;
      const pointerLeftOfMidpoint = event.clientX < rect.left + rect.width / 2;

      return pointerAboveMidpoint || (sameRow && pointerLeftOfMidpoint);
    }) ?? null;

  return {
    stayType,
    tier,
    beforeHotelId: hotelCard?.dataset.hotelId || null
  };
}

function countUniqueBrands(hotels: HotelRecord[]) {
  return new Set(hotels.map((hotel) => hotel.brand)).size;
}

function countAdditionalFutureBrands(exploredHotels: HotelRecord[], futureHotels: HotelRecord[]) {
  const exploredBrands = new Set(exploredHotels.map((hotel) => hotel.brand));

  return new Set(
    futureHotels
      .map((hotel) => hotel.brand)
      .filter((brand) => !exploredBrands.has(brand))
  ).size;
}

function countSuites(hotels: HotelRecord[]) {
  return hotels.reduce(
    (total, hotel) => total + hotel.roomEntries.filter((entry) => entry.kind === 'SUITE').length,
    0
  );
}

function formatRoomEntries(entries: RoomEntry[]) {
  return entries.map((entry) => entry.label).join(', ');
}

function normalizeTopPickSlots(value: unknown): TopPickSlot[] {
  if (!Array.isArray(value)) {
    return DEFAULT_TOP_PICKS;
  }

  const byRank = new Map<TopPickRank, TopPickSlot>();

  value.forEach((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return;
    }

    const record = entry as Record<string, unknown>;
    const rank = record.rank;

    if (rank !== 1 && rank !== 2 && rank !== 3) {
      return;
    }

    byRank.set(rank, {
      rank,
      hotelId: typeof record.hotelId === 'string' ? record.hotelId : '',
      imageUrl: typeof record.imageUrl === 'string' ? record.imageUrl : ''
    });
  });

  return DEFAULT_TOP_PICKS.map((slot) => byRank.get(slot.rank) ?? slot);
}

function normalizeTopSuiteSlots(value: unknown): TopSuiteSlot[] {
  if (!Array.isArray(value)) {
    return DEFAULT_TOP_SUITES;
  }

  const byRank = new Map<TopPickRank, TopSuiteSlot>();

  value.forEach((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return;
    }

    const record = entry as Record<string, unknown>;
    const rank = record.rank;

    if (rank !== 1 && rank !== 2 && rank !== 3) {
      return;
    }

    byRank.set(rank, {
      rank,
      hotelId: typeof record.hotelId === 'string' ? record.hotelId : '',
      suiteName: typeof record.suiteName === 'string' ? record.suiteName : '',
      imageUrl: typeof record.imageUrl === 'string' ? record.imageUrl : ''
    });
  });

  return DEFAULT_TOP_SUITES.map((slot) => byRank.get(slot.rank) ?? slot);
}

function normalizeTopFutureStaySlots(value: unknown): TopFutureStaySlot[] {
  if (!Array.isArray(value)) {
    return DEFAULT_TOP_FUTURE_STAYS;
  }

  const byRank = new Map<TopPickRank, TopFutureStaySlot>();

  value.forEach((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return;
    }

    const record = entry as Record<string, unknown>;
    const rank = record.rank;

    if (rank !== 1 && rank !== 2 && rank !== 3) {
      return;
    }

    byRank.set(rank, {
      rank,
      hotelId: typeof record.hotelId === 'string' ? record.hotelId : '',
      location: typeof record.location === 'string' ? record.location : '',
      imageUrl: typeof record.imageUrl === 'string' ? record.imageUrl : ''
    });
  });

  return DEFAULT_TOP_FUTURE_STAYS.map((slot) => byRank.get(slot.rank) ?? slot);
}

function normalizeTopExperienceSlots(value: unknown): TopExperienceSlot[] {
  if (!Array.isArray(value)) {
    return DEFAULT_TOP_EXPERIENCES;
  }

  const byRank = new Map<TopPickRank, TopExperienceSlot>();

  value.forEach((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return;
    }

    const record = entry as Record<string, unknown>;
    const rank = record.rank;

    if (rank !== 1 && rank !== 2 && rank !== 3) {
      return;
    }

    byRank.set(rank, {
      rank,
      hotelId: typeof record.hotelId === 'string' ? record.hotelId : '',
      description: typeof record.description === 'string' ? record.description : '',
      imageUrl: typeof record.imageUrl === 'string' ? record.imageUrl : ''
    });
  });

  return DEFAULT_TOP_EXPERIENCES.map((slot) => byRank.get(slot.rank) ?? slot);
}

function normalizeTopUnderratedSlots(value: unknown): TopUnderratedSlot[] {
  if (!Array.isArray(value)) {
    return DEFAULT_TOP_UNDERRATED;
  }

  const byRank = new Map<TopPickRank, TopUnderratedSlot>();

  value.forEach((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return;
    }

    const record = entry as Record<string, unknown>;
    const rank = record.rank;

    if (rank !== 1 && rank !== 2 && rank !== 3) {
      return;
    }

    byRank.set(rank, {
      rank,
      hotelId: typeof record.hotelId === 'string' ? record.hotelId : '',
      imageUrl: typeof record.imageUrl === 'string' ? record.imageUrl : ''
    });
  });

  return DEFAULT_TOP_UNDERRATED.map((slot) => byRank.get(slot.rank) ?? slot);
}

function normalizeTopReturnStaySlots(value: unknown): TopReturnStaySlot[] {
  if (!Array.isArray(value)) {
    return DEFAULT_TOP_RETURN_STAYS;
  }

  const byRank = new Map<TopPickRank, TopReturnStaySlot>();

  value.forEach((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return;
    }

    const record = entry as Record<string, unknown>;
    const rank = record.rank;

    if (rank !== 1 && rank !== 2 && rank !== 3) {
      return;
    }

    byRank.set(rank, {
      rank,
      hotelId: typeof record.hotelId === 'string' ? record.hotelId : '',
      imageUrl: typeof record.imageUrl === 'string' ? record.imageUrl : ''
    });
  });

  return DEFAULT_TOP_RETURN_STAYS.map((slot) => byRank.get(slot.rank) ?? slot);
}

function normalizeDisplayPreferences(value: unknown): DisplayPreferences {
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

function hexToRgb(hex: string) {
  const sanitized = hex.replace('#', '');
  const normalized = sanitized.length === 3
    ? sanitized
        .split('')
        .map((char) => `${char}${char}`)
        .join('')
    : sanitized;

  const value = Number.parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function shiftColor(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex);
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

  const shifted = {
    r: clamp(r + amount),
    g: clamp(g + amount / 2),
    b: clamp(b - amount / 3)
  };

  return `#${[shifted.r, shifted.g, shifted.b]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

function getBrandVisualStyle(brandName: string, brandColor: string): BrandVisualStyle {
  const hash = [...brandName].reduce((total, char) => total + char.charCodeAt(0), 0);
  const offset = (hash % 5) * 16 - 24;
  const accent = shiftColor(brandColor, offset);
  const paleAccent = shiftColor(brandColor, offset > 0 ? 42 : 28);

  return {
    borderColor: rgba(brandColor, 0.55),
    background: `linear-gradient(135deg, ${rgba(accent, 0.14)} 0%, ${rgba(paleAccent, 0.1)} 34%, rgba(255,255,255,0.96) 100%)`,
    labelColor: shiftColor(brandColor, -22),
    dotColor: accent,
    shadowColor: rgba(accent, 0.14)
  };
}

export function HyattTierListClient({
  initialHotels,
  initialDashboardPreferences,
  persistenceMode
}: {
  initialHotels: HotelRecord[];
  initialDashboardPreferences: DashboardPreferencesRecord;
  persistenceMode: PersistenceMode;
}) {
  const [hotels, setHotels] = useState(() => normalizeHotelCollection(initialHotels));
  const [modalState, setModalState] = useState<ModalState>(null);
  const [draft, setDraft] = useState<HotelDraft>(DEFAULT_DRAFT);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedHotelId, setDraggedHotelId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTargetState>(null);
  const [recentlyDraggedHotelId, setRecentlyDraggedHotelId] = useState<string | null>(null);
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [isTravelTimelineCompactMode, setIsTravelTimelineCompactMode] = useState(false);
  const [activeSuiteSlideIndex, setActiveSuiteSlideIndex] = useState(0);
  const [activeBucketListSlideIndex, setActiveBucketListSlideIndex] = useState(0);
  const suiteSwipeStartXRef = useRef<number | null>(null);
  const suiteSwipeDeltaXRef = useRef(0);
  const bucketListSwipeStartXRef = useRef<number | null>(null);
  const bucketListSwipeDeltaXRef = useRef(0);
  const tierBoardSectionRef = useRef<HTMLElement | null>(null);
  const futureHotelsSectionRef = useRef<HTMLElement | null>(null);
  const suiteExplorationsSectionRef = useRef<HTMLElement | null>(null);
  const bucketListSectionRef = useRef<HTMLElement | null>(null);
  const [isAllBrandsOpen, setIsAllBrandsOpen] = useState(false);
  const [isExploredBrandsOpen, setIsExploredBrandsOpen] = useState(false);
  const [isKellyBrandsOpen, setIsKellyBrandsOpen] = useState(false);
  const [isFutureBrandsOpen, setIsFutureBrandsOpen] = useState(false);
  const [isTopOverviewOpen, setIsTopOverviewOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTopPicksOpen, setIsTopPicksOpen] = useState(false);
  const [isTopSuitesOpen, setIsTopSuitesOpen] = useState(false);
  const [isTopFutureStaysOpen, setIsTopFutureStaysOpen] = useState(false);
  const [isTopExperiencesOpen, setIsTopExperiencesOpen] = useState(false);
  const [isTopUnderratedOpen, setIsTopUnderratedOpen] = useState(false);
  const [isTopReturnStaysOpen, setIsTopReturnStaysOpen] = useState(false);
  const [isSuitePickerOpen, setIsSuitePickerOpen] = useState(false);
  const [isKellyHotelsPickerOpen, setIsKellyHotelsPickerOpen] = useState(false);
  const [isBucketListPickerOpen, setIsBucketListPickerOpen] = useState(false);
  const [selectedBucketListBrandName, setSelectedBucketListBrandName] = useState(ALL_BUCKET_LIST_BRANDS);
  const [selectedBrandName, setSelectedBrandName] = useState<string | null>(null);
  const [activeKellySuiteSlideIndex, setActiveKellySuiteSlideIndex] = useState(0);
  const reorderRequestIdRef = useRef(0);
  const draggedHotelIdRef = useRef<string | null>(null);
  const [topPicks, setTopPicks] = useState<TopPickSlot[]>(initialDashboardPreferences.topPicks);
  const [topPicksDraft, setTopPicksDraft] = useState<TopPickSlot[]>(initialDashboardPreferences.topPicks);
  const [topPicksError, setTopPicksError] = useState<string | null>(null);
  const [topSuites, setTopSuites] = useState<TopSuiteSlot[]>(initialDashboardPreferences.topSuites);
  const [topSuitesDraft, setTopSuitesDraft] = useState<TopSuiteSlot[]>(initialDashboardPreferences.topSuites);
  const [topSuitesError, setTopSuitesError] = useState<string | null>(null);
  const [topFutureStays, setTopFutureStays] = useState<TopFutureStaySlot[]>(initialDashboardPreferences.topFutureStays ?? DEFAULT_TOP_FUTURE_STAYS);
  const [topFutureStaysDraft, setTopFutureStaysDraft] = useState<TopFutureStaySlot[]>(initialDashboardPreferences.topFutureStays ?? DEFAULT_TOP_FUTURE_STAYS);
  const [topFutureStaysError, setTopFutureStaysError] = useState<string | null>(null);
  const [topExperiences, setTopExperiences] = useState<TopExperienceSlot[]>(initialDashboardPreferences.topExperiences ?? DEFAULT_TOP_EXPERIENCES);
  const [topExperiencesDraft, setTopExperiencesDraft] = useState<TopExperienceSlot[]>(initialDashboardPreferences.topExperiences ?? DEFAULT_TOP_EXPERIENCES);
  const [topExperiencesError, setTopExperiencesError] = useState<string | null>(null);
  const [topUnderrated, setTopUnderrated] = useState<TopUnderratedSlot[]>(initialDashboardPreferences.topUnderrated ?? DEFAULT_TOP_UNDERRATED);
  const [topUnderratedDraft, setTopUnderratedDraft] = useState<TopUnderratedSlot[]>(initialDashboardPreferences.topUnderrated ?? DEFAULT_TOP_UNDERRATED);
  const [topUnderratedError, setTopUnderratedError] = useState<string | null>(null);
  const [topReturnStays, setTopReturnStays] = useState<TopReturnStaySlot[]>(initialDashboardPreferences.topReturnStays ?? DEFAULT_TOP_RETURN_STAYS);
  const [topReturnStaysDraft, setTopReturnStaysDraft] = useState<TopReturnStaySlot[]>(initialDashboardPreferences.topReturnStays ?? DEFAULT_TOP_RETURN_STAYS);
  const [topReturnStaysError, setTopReturnStaysError] = useState<string | null>(null);
  const [displayPreferences, setDisplayPreferences] = useState<DisplayPreferences>(initialDashboardPreferences.displayPreferences);

  useEffect(() => {
    setIsHydrated(true);

    if (persistenceMode === 'local') {
      const storedHotels = window.localStorage.getItem(LOCAL_STORAGE_KEY);

      if (storedHotels) {
        try {
          const parsedHotels = JSON.parse(storedHotels) as unknown[];
          setHotels(normalizeHotelCollection(parsedHotels.map(normalizeHotelRecord)));
        } catch {
          window.localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      }
    }

    if (persistenceMode === 'local') {
      const storedTopPicks = window.localStorage.getItem(TOP_PICKS_STORAGE_KEY);

      if (storedTopPicks) {
        try {
          const parsedTopPicks = JSON.parse(storedTopPicks) as unknown;
          const normalizedTopPicks = normalizeTopPickSlots(parsedTopPicks);
          setTopPicks(normalizedTopPicks);
          setTopPicksDraft(normalizedTopPicks);
        } catch {
          window.localStorage.removeItem(TOP_PICKS_STORAGE_KEY);
        }
      }

      const storedTopSuites = window.localStorage.getItem(TOP_SUITES_STORAGE_KEY);

      if (storedTopSuites) {
        try {
          const parsedTopSuites = JSON.parse(storedTopSuites) as unknown;
          const normalizedTopSuites = normalizeTopSuiteSlots(parsedTopSuites);
          setTopSuites(normalizedTopSuites);
          setTopSuitesDraft(normalizedTopSuites);
        } catch {
          window.localStorage.removeItem(TOP_SUITES_STORAGE_KEY);
        }
      }

      const storedTopFutureStays = window.localStorage.getItem(TOP_FUTURE_STAYS_STORAGE_KEY);

      if (storedTopFutureStays) {
        try {
          const parsedTopFutureStays = JSON.parse(storedTopFutureStays) as unknown;
          const normalizedTopFutureStays = normalizeTopFutureStaySlots(parsedTopFutureStays);
          setTopFutureStays(normalizedTopFutureStays);
          setTopFutureStaysDraft(normalizedTopFutureStays);
        } catch {
          window.localStorage.removeItem(TOP_FUTURE_STAYS_STORAGE_KEY);
        }
      }

      const storedTopExperiences = window.localStorage.getItem(TOP_EXPERIENCES_STORAGE_KEY);

      if (storedTopExperiences) {
        try {
          const parsedTopExperiences = JSON.parse(storedTopExperiences) as unknown;
          const normalizedTopExperiences = normalizeTopExperienceSlots(parsedTopExperiences);
          setTopExperiences(normalizedTopExperiences);
          setTopExperiencesDraft(normalizedTopExperiences);
        } catch {
          window.localStorage.removeItem(TOP_EXPERIENCES_STORAGE_KEY);
        }
      }

      const storedTopUnderrated = window.localStorage.getItem(TOP_UNDERRATED_STORAGE_KEY);

      if (storedTopUnderrated) {
        try {
          const parsedTopUnderrated = JSON.parse(storedTopUnderrated) as unknown;
          const normalizedTopUnderrated = normalizeTopUnderratedSlots(parsedTopUnderrated);
          setTopUnderrated(normalizedTopUnderrated);
          setTopUnderratedDraft(normalizedTopUnderrated);
        } catch {
          window.localStorage.removeItem(TOP_UNDERRATED_STORAGE_KEY);
        }
      }

      const storedTopReturnStays = window.localStorage.getItem(TOP_RETURN_STAYS_STORAGE_KEY);

      if (storedTopReturnStays) {
        try {
          const parsedTopReturnStays = JSON.parse(storedTopReturnStays) as unknown;
          const normalizedTopReturnStays = normalizeTopReturnStaySlots(parsedTopReturnStays);
          setTopReturnStays(normalizedTopReturnStays);
          setTopReturnStaysDraft(normalizedTopReturnStays);
        } catch {
          window.localStorage.removeItem(TOP_RETURN_STAYS_STORAGE_KEY);
        }
      }

      const storedDisplayPreferences = window.localStorage.getItem(DISPLAY_PREFERENCES_STORAGE_KEY);

      if (storedDisplayPreferences) {
        try {
          setDisplayPreferences(normalizeDisplayPreferences(JSON.parse(storedDisplayPreferences) as unknown));
        } catch {
          window.localStorage.removeItem(DISPLAY_PREFERENCES_STORAGE_KEY);
        }
      }
    }
  }, [persistenceMode]);

  useEffect(() => {
    if (!isHydrated || persistenceMode !== 'local') {
      return;
    }

    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(hotels));
  }, [hotels, isHydrated, persistenceMode]);

  useEffect(() => {
    if (!isHydrated || persistenceMode !== 'local') {
      return;
    }

    window.localStorage.setItem(TOP_PICKS_STORAGE_KEY, JSON.stringify(topPicks));
  }, [isHydrated, persistenceMode, topPicks]);

  useEffect(() => {
    if (!isHydrated || persistenceMode !== 'local') {
      return;
    }

    window.localStorage.setItem(TOP_SUITES_STORAGE_KEY, JSON.stringify(topSuites));
  }, [isHydrated, persistenceMode, topSuites]);

  useEffect(() => {
    if (!isHydrated || persistenceMode !== 'local') {
      return;
    }

    window.localStorage.setItem(TOP_FUTURE_STAYS_STORAGE_KEY, JSON.stringify(topFutureStays));
  }, [isHydrated, persistenceMode, topFutureStays]);

  useEffect(() => {
    if (!isHydrated || persistenceMode !== 'local') {
      return;
    }

    window.localStorage.setItem(TOP_EXPERIENCES_STORAGE_KEY, JSON.stringify(topExperiences));
  }, [isHydrated, persistenceMode, topExperiences]);

  useEffect(() => {
    if (!isHydrated || persistenceMode !== 'local') {
      return;
    }

    window.localStorage.setItem(TOP_UNDERRATED_STORAGE_KEY, JSON.stringify(topUnderrated));
  }, [isHydrated, persistenceMode, topUnderrated]);

  useEffect(() => {
    if (!isHydrated || persistenceMode !== 'local') {
      return;
    }

    window.localStorage.setItem(TOP_RETURN_STAYS_STORAGE_KEY, JSON.stringify(topReturnStays));
  }, [isHydrated, persistenceMode, topReturnStays]);

  useEffect(() => {
    if (!isHydrated || persistenceMode !== 'local') {
      return;
    }

    window.localStorage.setItem(DISPLAY_PREFERENCES_STORAGE_KEY, JSON.stringify(displayPreferences));
  }, [displayPreferences, isHydrated, persistenceMode]);

  const exploredHotels = useMemo(
    () => sortHotelsByTier(hotels.filter((hotel) => hotel.stayType === 'EXPLORED')),
    [hotels]
  );
  const futureHotels = useMemo(
    () => sortFutureHotelsByPlannedDate(hotels.filter((hotel) => hotel.stayType === 'FUTURE')),
    [hotels]
  );
  const bucketListHotels = useMemo(
    () => sortHotelsByTier(hotels.filter((hotel) => hotel.stayType === 'BUCKET_LIST')),
    [hotels]
  );
  const bucketListBrandOptions = useMemo(() => {
    const bucketListBrandNames = new Set(bucketListHotels.map((hotel) => hotel.brand));

    return HYATT_BRANDS.filter((brand) => bucketListBrandNames.has(brand.name)).map((brand) => ({
      value: brand.name,
      label: brand.name,
      color: brand.color
    }));
  }, [bucketListHotels]);
  const filteredBucketListHotels = useMemo(() => {
    if (selectedBucketListBrandName === ALL_BUCKET_LIST_BRANDS) {
      return bucketListHotels;
    }

    return bucketListHotels.filter((hotel) => hotel.brand === selectedBucketListBrandName);
  }, [bucketListHotels, selectedBucketListBrandName]);

  const hotelsByTier = useMemo(() => {
    return TIERS.reduce(
      (collection, tier) => {
        collection[tier] = exploredHotels.filter((hotel) => hotel.tier === tier);
        return collection;
      },
      {} as Record<Tier, HotelRecord[]>
    );
  }, [exploredHotels]);

  const exploredBrandCount = useMemo(() => countUniqueBrands(exploredHotels), [exploredHotels]);
  const exploredSuiteCount = useMemo(() => countSuites(exploredHotels), [exploredHotels]);
  const brandsExploringCount = useMemo(
    () => countAdditionalFutureBrands(exploredHotels, futureHotels),
    [exploredHotels, futureHotels]
  );
  const mappedBrands = useMemo(
    () => HYATT_BRANDS.filter((brand) => exploredHotels.some((hotel) => hotel.brand === brand.name)),
    [exploredHotels]
  );
  const selectedBrand = useMemo(
    () => (selectedBrandName ? BRAND_BY_NAME[selectedBrandName] ?? null : null),
    [selectedBrandName]
  );
  const exploredBrandNames = useMemo(() => new Set(exploredHotels.map((hotel) => hotel.brand)), [exploredHotels]);
  const futureExploringBrands = useMemo(
    () => HYATT_BRANDS.filter((brand) => futureHotels.some((hotel) => hotel.brand === brand.name) && !exploredBrandNames.has(brand.name)),
    [exploredBrandNames, futureHotels]
  );
  useEffect(() => {
    if (
      selectedBucketListBrandName !== ALL_BUCKET_LIST_BRANDS
      && !bucketListBrandOptions.some((option) => option.value === selectedBucketListBrandName)
    ) {
      setSelectedBucketListBrandName(ALL_BUCKET_LIST_BRANDS);
    }
  }, [bucketListBrandOptions, selectedBucketListBrandName]);
  const loggedSuiteSlides = useMemo<LoggedSuiteEntry[]>(
    () => {
      return exploredHotels
        .flatMap((hotel) =>
        hotel.roomEntries
          .filter((entry) => entry.kind === 'SUITE')
          .map((entry, index) => ({
            id: `${hotel.id}-${entry.label}-${index}`,
            suiteName: entry.label,
            imageUrl: entry.imageUrl,
            stars: entry.stars,
            hotel
          }))
      )
        .map((entry, index) => ({ entry, index }))
        .sort((left, right) => {
          const leftStars = left.entry.stars ?? -1;
          const rightStars = right.entry.stars ?? -1;

          if (rightStars !== leftStars) {
            return rightStars - leftStars;
          }

          return left.index - right.index;
        })
        .map(({ entry }) => entry);
    },
    [exploredHotels]
  );
  const bucketListSlides = useMemo<BucketListSlide[]>(
    () =>
      bucketListHotels
        .filter((hotel) => hotel.bucketListLocation.trim() && hotel.bucketListImageUrl.trim())
        .map((hotel) => ({
          id: hotel.id,
          imageUrl: hotel.bucketListImageUrl,
          location: hotel.bucketListLocation,
          hotel
        })),
    [bucketListHotels]
  );
  useEffect(() => {
    setActiveSuiteSlideIndex((current) => {
      if (loggedSuiteSlides.length === 0) {
        return 0;
      }

      return Math.min(current, loggedSuiteSlides.length - 1);
    });
  }, [loggedSuiteSlides.length]);

  useEffect(() => {
    setActiveBucketListSlideIndex((current) => {
      if (bucketListSlides.length === 0) {
        return 0;
      }

      return Math.min(current, bucketListSlides.length - 1);
    });
  }, [bucketListSlides.length]);

  function showPreviousSuiteSlide() {
    setActiveSuiteSlideIndex((current) =>
      loggedSuiteSlides.length ? (current - 1 + loggedSuiteSlides.length) % loggedSuiteSlides.length : 0
    );
  }

  function showNextSuiteSlide() {
    setActiveSuiteSlideIndex((current) => (loggedSuiteSlides.length ? (current + 1) % loggedSuiteSlides.length : 0));
  }

  function showPreviousBucketListSlide() {
    setActiveBucketListSlideIndex((current) =>
      bucketListSlides.length ? (current - 1 + bucketListSlides.length) % bucketListSlides.length : 0
    );
  }

  function showNextBucketListSlide() {
    setActiveBucketListSlideIndex((current) =>
      bucketListSlides.length ? (current + 1) % bucketListSlides.length : 0
    );
  }

  function showPreviousKellySuiteSlide() {
    setActiveKellySuiteSlideIndex((current) =>
      kellySuiteSlides.length ? (current - 1 + kellySuiteSlides.length) % kellySuiteSlides.length : 0
    );
  }

  function showNextKellySuiteSlide() {
    setActiveKellySuiteSlideIndex((current) =>
      kellySuiteSlides.length ? (current + 1) % kellySuiteSlides.length : 0
    );
  }

  useEffect(() => {
    if (!displayPreferences.showSuiteSlideshow || loggedSuiteSlides.length <= 1) {
      return;
    }

    const slideCount = loggedSuiteSlides.length;

    function handleSuiteSlideshowKeydown(event: KeyboardEvent) {
      const target = event.target;

      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActiveSuiteSlideIndex((current) => ((current - 1 + slideCount) % slideCount));
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setActiveSuiteSlideIndex((current) => ((current + 1) % slideCount));
      }
    }

    window.addEventListener('keydown', handleSuiteSlideshowKeydown);
    return () => window.removeEventListener('keydown', handleSuiteSlideshowKeydown);
  }, [displayPreferences.showSuiteSlideshow, loggedSuiteSlides.length]);

  useEffect(() => {
    if (!displayPreferences.showBucketListSlideshow || bucketListSlides.length <= 1) {
      return;
    }

    const slideCount = bucketListSlides.length;

    function handleBucketListSlideshowKeydown(event: KeyboardEvent) {
      const target = event.target;

      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActiveBucketListSlideIndex((current) => ((current - 1 + slideCount) % slideCount));
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setActiveBucketListSlideIndex((current) => ((current + 1) % slideCount));
      }
    }

    window.addEventListener('keydown', handleBucketListSlideshowKeydown);
    return () => window.removeEventListener('keydown', handleBucketListSlideshowKeydown);
  }, [bucketListSlides.length, displayPreferences.showBucketListSlideshow]);

  const activeSuiteSlide = loggedSuiteSlides[activeSuiteSlideIndex] ?? null;
  const previousSuiteSlide =
    loggedSuiteSlides.length > 1
      ? loggedSuiteSlides[(activeSuiteSlideIndex - 1 + loggedSuiteSlides.length) % loggedSuiteSlides.length]
      : null;
  const nextSuiteSlide =
    loggedSuiteSlides.length > 1
      ? loggedSuiteSlides[(activeSuiteSlideIndex + 1) % loggedSuiteSlides.length]
      : null;
  const activeBucketListSlide = bucketListSlides[activeBucketListSlideIndex] ?? null;
  const previousBucketListSlide =
    bucketListSlides.length > 1
      ? bucketListSlides[(activeBucketListSlideIndex - 1 + bucketListSlides.length) % bucketListSlides.length]
      : null;
  const nextBucketListSlide =
    bucketListSlides.length > 1
      ? bucketListSlides[(activeBucketListSlideIndex + 1) % bucketListSlides.length]
      : null;
  const exploredHotelsWithSuites = useMemo(
    () => exploredHotels.filter((hotel) => hotel.roomEntries.some((entry) => entry.kind === 'SUITE')),
    [exploredHotels]
  );
  const kellyExplorationHotels = useMemo(
    () =>
      sortHotelsByTier(
        exploredHotels.filter(
          (hotel) =>
            hotel.stayEntries.some((entry) => entry.withKelly) ||
            hotel.roomEntries.some((entry) => entry.kind === 'SUITE' && entry.withKelly)
        )
      ),
    [exploredHotels]
  );
  const kellySuiteSlides = useMemo<LoggedSuiteEntry[]>(
    () =>
      kellyExplorationHotels
        .flatMap((hotel) =>
          hotel.roomEntries
            .filter((entry) => entry.kind === 'SUITE' && entry.withKelly)
            .map((entry, index) => ({
              id: `${hotel.id}-${entry.label}-${index}`,
              suiteName: entry.label,
              imageUrl: entry.imageUrl,
              stars: entry.stars,
              hotel
            }))
        ),
    [kellyExplorationHotels]
  );
  const kellySuiteCount = useMemo(
    () => kellyExplorationHotels.reduce((total, hotel) => total + hotel.roomEntries.filter((entry) => entry.kind === 'SUITE' && entry.withKelly).length, 0),
    [kellyExplorationHotels]
  );
  const kellyExploredBrandNames = useMemo(
    () => new Set(kellyExplorationHotels.map((hotel) => hotel.brand)),
    [kellyExplorationHotels]
  );
  const activeKellySuiteSlide = kellySuiteSlides[activeKellySuiteSlideIndex] ?? null;
  const previousKellySuiteSlide =
    kellySuiteSlides.length > 1
      ? kellySuiteSlides[(activeKellySuiteSlideIndex - 1 + kellySuiteSlides.length) % kellySuiteSlides.length]
      : null;
  const nextKellySuiteSlide =
    kellySuiteSlides.length > 1
      ? kellySuiteSlides[(activeKellySuiteSlideIndex + 1) % kellySuiteSlides.length]
      : null;

  useEffect(() => {
    setActiveKellySuiteSlideIndex((current) => {
      if (kellySuiteSlides.length === 0) {
        return 0;
      }

      return Math.min(current, kellySuiteSlides.length - 1);
    });
  }, [kellySuiteSlides.length]);

  const selectedBrandHotels = useMemo(() => {
    if (!selectedBrandName) {
      return [];
    }

    const brandHotels = hotels.filter((hotel) => hotel.brand === selectedBrandName);
    return [
      ...sortHotelsByTier(brandHotels.filter((hotel) => hotel.stayType === 'EXPLORED')),
      ...sortFutureHotelsByPlannedDate(brandHotels.filter((hotel) => hotel.stayType === 'FUTURE')),
      ...sortHotelsByTier(brandHotels.filter((hotel) => hotel.stayType === 'BUCKET_LIST'))
    ];
  }, [hotels, selectedBrandName]);
  const topPicksResolved = useMemo(
    () =>
      topPicks
        .map((slot) => ({
          ...slot,
          hotel: exploredHotels.find((hotel) => hotel.id === slot.hotelId) ?? null
        }))
        .filter((slot) => slot.hotel)
        .sort((left, right) => left.rank - right.rank),
    [exploredHotels, topPicks]
  );
  const hasCompleteTopPicks = topPicksResolved.length === 3 && topPicks.every((slot) => slot.hotelId);
  const topSuitesResolved = useMemo(
    () =>
      topSuites
        .map((slot) => ({
          ...slot,
          suiteName: slot.suiteName.trim(),
          hotel: exploredHotelsWithSuites.find((hotel) => hotel.id === slot.hotelId) ?? null
        }))
        .filter((slot) => slot.hotel && slot.suiteName)
        .sort((left, right) => left.rank - right.rank),
    [exploredHotelsWithSuites, topSuites]
  );
  const hasCompleteTopSuites =
    topSuitesResolved.length === 3 && topSuites.every((slot) => slot.hotelId && slot.suiteName.trim());
  const topFutureStaysResolved = useMemo(
    () =>
      topFutureStays
        .map((slot) => ({
          ...slot,
          location: slot.location.trim(),
          hotel: futureHotels.find((hotel) => hotel.id === slot.hotelId) ?? null
        }))
        .filter((slot) => slot.hotel && slot.location)
        .sort((left, right) => left.rank - right.rank),
    [futureHotels, topFutureStays]
  );
  const hasCompleteTopFutureStays =
    topFutureStaysResolved.length === 3 && topFutureStays.every((slot) => slot.hotelId && slot.location.trim());
  const topExperiencesResolved = useMemo(
    () =>
      topExperiences
        .map((slot) => ({
          ...slot,
          description: slot.description.trim(),
          hotel: exploredHotels.find((hotel) => hotel.id === slot.hotelId) ?? null
        }))
        .filter((slot) => slot.hotel && slot.description)
        .sort((left, right) => left.rank - right.rank),
    [exploredHotels, topExperiences]
  );
  const hasCompleteTopExperiences =
    topExperiencesResolved.length === 3 && topExperiences.every((slot) => slot.hotelId && slot.description.trim());
  const topUnderratedResolved = useMemo(
    () =>
      topUnderrated
        .map((slot) => ({
          ...slot,
          hotel: exploredHotels.find((hotel) => hotel.id === slot.hotelId) ?? null
        }))
        .filter((slot) => slot.hotel)
        .sort((left, right) => left.rank - right.rank),
    [exploredHotels, topUnderrated]
  );
  const hasCompleteTopUnderrated = topUnderratedResolved.length === 3 && topUnderrated.every((slot) => slot.hotelId);
  const topReturnStaysResolved = useMemo(
    () =>
      topReturnStays
        .map((slot) => ({
          ...slot,
          hotel: exploredHotels.find((hotel) => hotel.id === slot.hotelId) ?? null
        }))
        .filter((slot) => slot.hotel)
        .sort((left, right) => left.rank - right.rank),
    [exploredHotels, topReturnStays]
  );
  const hasCompleteTopReturnStays = topReturnStaysResolved.length === 3 && topReturnStays.every((slot) => slot.hotelId);
  const topOverviewSections = useMemo<TopOverviewSection[]>(
    () => [
      {
        id: 'top-hotels',
        label: 'Top 3 Hotels',
        title: 'Best Overall',
        emptyMessage: 'No hotel podium picks yet.',
        items: topPicksResolved.flatMap((slot) =>
          slot.hotel
            ? [
                {
                  rank: slot.rank,
                  hotel: slot.hotel,
                  imageUrl: slot.imageUrl,
                  title: slot.hotel.name
                }
              ]
            : []
        )
      },
      {
        id: 'top-suites',
        label: 'Top 3 Suites',
        title: 'Favorite Suites',
        emptyMessage: 'No suite podium picks yet.',
        items: topSuitesResolved.flatMap((slot) =>
          slot.hotel
            ? [
                {
                  rank: slot.rank,
                  hotel: slot.hotel,
                  imageUrl: slot.imageUrl,
                  title: slot.hotel.name,
                  imageLabel: slot.suiteName || undefined
                }
              ]
            : []
        )
      },
      {
        id: 'top-future-stays',
        label: 'Top 3 Future Stays',
        title: 'Most Anticipated',
        emptyMessage: 'No future-stay podium picks yet.',
        items: topFutureStaysResolved.flatMap((slot) =>
          slot.hotel
            ? [
                {
                  rank: slot.rank,
                  hotel: slot.hotel,
                  imageUrl: slot.imageUrl,
                  title: slot.hotel.name
                }
              ]
            : []
        )
      },
      {
        id: 'top-experiences',
        label: 'Top 3 Experiences',
        title: 'Most Memorable',
        emptyMessage: 'No memorable experiences picked yet.',
        items: topExperiencesResolved.flatMap((slot) =>
          slot.hotel
            ? [
                {
                  rank: slot.rank,
                  hotel: slot.hotel,
                  imageUrl: slot.imageUrl,
                  title: slot.hotel.name
                }
              ]
            : []
        )
      },
      {
        id: 'top-underrated',
        label: 'Top 3 Underrated',
        title: 'Hidden Gems',
        emptyMessage: 'No underrated picks yet.',
        items: topUnderratedResolved.flatMap((slot) =>
          slot.hotel
            ? [
                {
                  rank: slot.rank,
                  hotel: slot.hotel,
                  imageUrl: slot.imageUrl,
                  title: slot.hotel.name
                }
              ]
            : []
        )
      },
      {
        id: 'top-return-stays',
        label: 'Top 3 Return Stays',
        title: 'Would Stay Again',
        emptyMessage: 'No return-stay picks yet.',
        items: topReturnStaysResolved.flatMap((slot) =>
          slot.hotel
            ? [
                {
                  rank: slot.rank,
                  hotel: slot.hotel,
                  imageUrl: slot.imageUrl,
                  title: slot.hotel.name
                }
              ]
            : []
        )
      }
    ],
    [
      topExperiencesResolved,
      topFutureStaysResolved,
      topPicksResolved,
      topReturnStaysResolved,
      topSuitesResolved,
      topUnderratedResolved
    ]
  );
  const travelTimelineYears = useMemo(() => {
    const flattened = exploredHotels.flatMap((hotel) =>
      hotel.stayEntries.map((stayEntry) => ({
        ...stayEntry,
        hotel
      }))
    );

    flattened.sort(
      (left, right) =>
        right.year - left.year ||
        right.month - left.month ||
        left.hotel.position - right.hotel.position ||
        left.hotel.name.localeCompare(right.hotel.name)
    );

    const years = new Map<number, typeof flattened>();

    flattened.forEach((entry) => {
      const collection = years.get(entry.year) ?? [];
      collection.push(entry);
      years.set(entry.year, collection);
    });

    return Array.from(years.entries())
      .sort((left, right) => right[0] - left[0])
      .map(([year, stays]) => ({ year, stays }));
  }, [exploredHotels]);
  const summaryCards = [
    { label: 'Hotels Explored', value: exploredHotels.length },
    { label: 'Brands Explored', value: `${exploredBrandCount}/${HYATT_BRANDS.length}` },
    { label: 'Suites Explored', value: exploredSuiteCount },
    { label: 'Planned Hotel Explorations', value: futureHotels.length },
    {
      label: 'Planned Brand Explorations',
      value: brandsExploringCount
    }
  ];

  const menuSections: DashboardMenuSection[] = [
    {
      id: 'topHotels' as const,
      label: 'Top 3 Hotels',
      description: 'Show or hide your hotel podium.',
      shown: displayPreferences.showTopHotels,
      toggle: () =>
        void updateDisplayPreferences({
          ...displayPreferences,
          showTopHotels: !displayPreferences.showTopHotels
        })
    },
    {
      id: 'topSuites' as const,
      label: 'Top 3 Suites',
      description: 'Show or hide your suite favorites.',
      shown: displayPreferences.showTopSuites,
      toggle: () =>
        void updateDisplayPreferences({
          ...displayPreferences,
          showTopSuites: !displayPreferences.showTopSuites
        })
    },
    {
      id: 'tierBoard' as const,
      label: 'Tier Board',
      description: 'Control visibility and compact mode together.',
      shown: displayPreferences.showTierBoard,
      compactToggle: {
        active: isCompactMode,
        toggle: () => setIsCompactMode((current) => !current),
        activeLabel: 'Compact on',
        inactiveLabel: 'Compact off'
      },
      toggle: () =>
        void updateDisplayPreferences({
          ...displayPreferences,
          showTierBoard: !displayPreferences.showTierBoard
        })
    },
    {
      id: 'futureHotels' as const,
      label: 'Planned Hotel Explorations',
      description: 'Show or hide your future stays board.',
      shown: displayPreferences.showFutureHotels,
      toggle: () =>
        void updateDisplayPreferences({
          ...displayPreferences,
          showFutureHotels: !displayPreferences.showFutureHotels
        })
    },
    {
      id: 'travelTimeline' as const,
      label: 'Travel Timeline',
      description: 'Show or hide your year-by-year stay log.',
      shown: displayPreferences.showTravelTimeline,
      compactToggle: {
        active: isTravelTimelineCompactMode,
        toggle: () => setIsTravelTimelineCompactMode((current) => !current),
        activeLabel: 'Compact on',
        inactiveLabel: 'Compact off'
      },
      toggle: () =>
        void updateDisplayPreferences({
          ...displayPreferences,
          showTravelTimeline: !displayPreferences.showTravelTimeline
        })
    },
    {
      id: 'suiteSlideshow' as const,
      label: 'Suite Slideshow',
      description: 'Show or hide your logged suites carousel.',
      shown: displayPreferences.showSuiteSlideshow,
      toggle: () =>
        void updateDisplayPreferences({
          ...displayPreferences,
          showSuiteSlideshow: !displayPreferences.showSuiteSlideshow
        })
    },
    {
      id: 'bucketListSlideshow' as const,
      label: 'My Hyatt Bucket List',
      description: 'Show or hide your bucket-list hotel carousel.',
      shown: displayPreferences.showBucketListSlideshow,
      toggle: () =>
        void updateDisplayPreferences({
          ...displayPreferences,
          showBucketListSlideshow: !displayPreferences.showBucketListSlideshow
        })
    },
    {
      id: 'kellyExplorations' as const,
      label: 'My Hyatt Exploration with Kelly ❤️❤️',
      description: 'Show or hide your shared explored-hotel section.',
      shown: displayPreferences.showKellyExplorations,
      toggle: () =>
        void updateDisplayPreferences({
          ...displayPreferences,
          showKellyExplorations: !displayPreferences.showKellyExplorations
        })
    },
    {
      id: 'topFutureStays' as const,
      label: 'Top 3 Future Stays',
      description: 'Show or hide your anticipated stays podium.',
      shown: displayPreferences.showTopFutureStays,
      toggle: () =>
        void updateDisplayPreferences({
          ...displayPreferences,
          showTopFutureStays: !displayPreferences.showTopFutureStays
        })
    },
    {
      id: 'topExperiences' as const,
      label: 'Top 3 Experiences',
      description: 'Show or hide your memorable-stays podium.',
      shown: displayPreferences.showTopExperiences,
      toggle: () =>
        void updateDisplayPreferences({
          ...displayPreferences,
          showTopExperiences: !displayPreferences.showTopExperiences
        })
    },
    {
      id: 'topUnderrated' as const,
      label: 'Top 3 Underrated',
      description: 'Show or hide your hidden gems podium.',
      shown: displayPreferences.showTopUnderrated,
      toggle: () =>
        void updateDisplayPreferences({
          ...displayPreferences,
          showTopUnderrated: !displayPreferences.showTopUnderrated
        })
    },
    {
      id: 'topReturnStays' as const,
      label: 'Top 3 Return Stays',
      description: 'Show or hide the stays you would revisit.',
      shown: displayPreferences.showTopReturnStays,
      toggle: () =>
        void updateDisplayPreferences({
          ...displayPreferences,
          showTopReturnStays: !displayPreferences.showTopReturnStays
        })
    }
  ];

  useEffect(() => {
    setTopPicks((current) =>
      current.map((slot) =>
        exploredHotels.some((hotel) => hotel.id === slot.hotelId)
          ? slot
          : { ...slot, hotelId: '', imageUrl: '' }
      )
    );
  }, [exploredHotels]);

  useEffect(() => {
    setTopSuites((current) =>
      current.map((slot) => {
        const hotel = exploredHotelsWithSuites.find((item) => item.id === slot.hotelId);

        if (!hotel) {
          return { ...slot, hotelId: '', suiteName: '', imageUrl: '' };
        }

        return slot;
      })
    );
  }, [exploredHotelsWithSuites]);

  useEffect(() => {
    setTopFutureStays((current) =>
      current.map((slot) => {
        const hotel = futureHotels.find((item) => item.id === slot.hotelId);

        if (!hotel) {
          return { ...slot, hotelId: '', location: '', imageUrl: '' };
        }

        return slot;
      })
    );
  }, [futureHotels]);

  useEffect(() => {
    setTopExperiences((current) =>
      current.map((slot) =>
        exploredHotels.some((hotel) => hotel.id === slot.hotelId)
          ? slot
          : { ...slot, hotelId: '', description: '', imageUrl: '' }
      )
    );
  }, [exploredHotels]);

  useEffect(() => {
    setTopUnderrated((current) =>
      current.map((slot) =>
        exploredHotels.some((hotel) => hotel.id === slot.hotelId)
          ? slot
          : { ...slot, hotelId: '', imageUrl: '' }
      )
    );
  }, [exploredHotels]);

  useEffect(() => {
    setTopReturnStays((current) =>
      current.map((slot) =>
        exploredHotels.some((hotel) => hotel.id === slot.hotelId)
          ? slot
          : { ...slot, hotelId: '', imageUrl: '' }
      )
    );
  }, [exploredHotels]);

  function closeModal() {
    setModalState(null);
    setDraft(DEFAULT_DRAFT);
    setErrorMessage(null);
  }

  function openTopPicksModal() {
    setTopPicksDraft(topPicks);
    setTopPicksError(null);
    setIsTopPicksOpen(true);
  }

  function scrollToSuiteExplorations() {
    suiteExplorationsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function scrollToTierBoard() {
    tierBoardSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function scrollToFutureHotels() {
    futureHotelsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function persistDashboardPreferences(nextPreferences: DashboardPreferencesPatch) {
    if (persistenceMode === 'local') {
      return;
    }

    const response = await fetch('/api/dashboard-preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(nextPreferences)
    });

    const result = (await response.json()) as { message?: string };

    if (!response.ok) {
      throw new Error(result.message || 'Unable to save dashboard preferences.');
    }
  }

  async function handleSaveTopPicks() {
    const selectedHotelIds = topPicksDraft.map((slot) => slot.hotelId).filter(Boolean);

    if (selectedHotelIds.length !== new Set(selectedHotelIds).size) {
      setTopPicksError('Each top pick must be a different hotel.');
      return;
    }

    const nextTopPicks = topPicksDraft.map((slot) => ({
      ...slot,
      imageUrl: slot.imageUrl.trim()
    }));

    const previousTopPicks = topPicks;

    setTopPicks(nextTopPicks);
    setTopPicksDraft(nextTopPicks);
    setTopPicksError(null);

    try {
      await persistDashboardPreferences({ topPicks: nextTopPicks });
      setIsTopPicksOpen(false);
    } catch (error) {
      setTopPicks(previousTopPicks);
      setTopPicksDraft(previousTopPicks);
      setTopPicksError(error instanceof Error ? error.message : 'Unable to save top 3 hotels.');
      return;
    }
  }

  function openTopSuitesModal() {
    setTopSuitesDraft(topSuites);
    setTopSuitesError(null);
    setIsTopSuitesOpen(true);
  }

  async function handleSaveTopSuites() {
    const selectedSuites = topSuitesDraft
      .map((slot) => `${slot.hotelId}::${slot.suiteName.trim().toLowerCase()}`)
      .filter((value) => value !== '::');

    if (selectedSuites.length !== new Set(selectedSuites).size) {
      setTopSuitesError('Each top suite must be a different hotel and suite combination.');
      return;
    }

    const nextTopSuites = topSuitesDraft.map((slot) => ({
      ...slot,
      suiteName: slot.suiteName.trim(),
      imageUrl: slot.imageUrl.trim()
    }));

    const previousTopSuites = topSuites;

    setTopSuites(nextTopSuites);
    setTopSuitesDraft(nextTopSuites);
    setTopSuitesError(null);

    try {
      await persistDashboardPreferences({ topSuites: nextTopSuites });
      setIsTopSuitesOpen(false);
    } catch (error) {
      setTopSuites(previousTopSuites);
      setTopSuitesDraft(previousTopSuites);
      setTopSuitesError(error instanceof Error ? error.message : 'Unable to save top 3 suites.');
      return;
    }
  }

  function openTopFutureStaysModal() {
    setTopFutureStaysDraft(topFutureStays);
    setTopFutureStaysError(null);
    setIsTopFutureStaysOpen(true);
  }

  function openSuitePickerModal() {
    setIsSuitePickerOpen(true);
  }

  function openKellyHotelsPickerModal() {
    setIsKellyHotelsPickerOpen(true);
  }

  function openBucketListPickerModal() {
    setIsBucketListPickerOpen(true);
  }

  async function handleSaveTopFutureStays() {
    const selectedHotelIds = topFutureStaysDraft.map((slot) => slot.hotelId).filter(Boolean);

    if (selectedHotelIds.length !== new Set(selectedHotelIds).size) {
      setTopFutureStaysError('Each future stay must be a different hotel.');
      return;
    }

    const nextTopFutureStays = topFutureStaysDraft.map((slot) => ({
      ...slot,
      location: slot.location.trim(),
      imageUrl: slot.imageUrl.trim()
    }));

    const previousTopFutureStays = topFutureStays;

    setTopFutureStays(nextTopFutureStays);
    setTopFutureStaysDraft(nextTopFutureStays);
    setTopFutureStaysError(null);

    try {
      await persistDashboardPreferences({ topFutureStays: nextTopFutureStays });
      setIsTopFutureStaysOpen(false);
    } catch (error) {
      setTopFutureStays(previousTopFutureStays);
      setTopFutureStaysDraft(previousTopFutureStays);
      setTopFutureStaysError(error instanceof Error ? error.message : 'Unable to save top 3 future stays.');
    }
  }

  function openTopExperiencesModal() {
    setTopExperiencesDraft(topExperiences);
    setTopExperiencesError(null);
    setIsTopExperiencesOpen(true);
  }

  async function handleSaveTopExperiences() {
    const selectedHotelIds = topExperiencesDraft.map((slot) => slot.hotelId).filter(Boolean);

    if (selectedHotelIds.length !== new Set(selectedHotelIds).size) {
      setTopExperiencesError('Each experience must be a different hotel.');
      return;
    }

    const nextTopExperiences = topExperiencesDraft.map((slot) => ({
      ...slot,
      description: slot.description.trim(),
      imageUrl: slot.imageUrl.trim()
    }));

    const previousTopExperiences = topExperiences;

    setTopExperiences(nextTopExperiences);
    setTopExperiencesDraft(nextTopExperiences);
    setTopExperiencesError(null);

    try {
      await persistDashboardPreferences({ topExperiences: nextTopExperiences });
      setIsTopExperiencesOpen(false);
    } catch (error) {
      setTopExperiences(previousTopExperiences);
      setTopExperiencesDraft(previousTopExperiences);
      setTopExperiencesError(error instanceof Error ? error.message : 'Unable to save top 3 experiences.');
    }
  }

  function openTopUnderratedModal() {
    setTopUnderratedDraft(topUnderrated);
    setTopUnderratedError(null);
    setIsTopUnderratedOpen(true);
  }

  async function handleSaveTopUnderrated() {
    const selectedHotelIds = topUnderratedDraft.map((slot) => slot.hotelId).filter(Boolean);

    if (selectedHotelIds.length !== new Set(selectedHotelIds).size) {
      setTopUnderratedError('Each underrated pick must be a different hotel.');
      return;
    }

    const nextTopUnderrated = topUnderratedDraft.map((slot) => ({
      ...slot,
      imageUrl: slot.imageUrl.trim()
    }));

    const previousTopUnderrated = topUnderrated;

    setTopUnderrated(nextTopUnderrated);
    setTopUnderratedDraft(nextTopUnderrated);
    setTopUnderratedError(null);

    try {
      await persistDashboardPreferences({ topUnderrated: nextTopUnderrated });
      setIsTopUnderratedOpen(false);
    } catch (error) {
      setTopUnderrated(previousTopUnderrated);
      setTopUnderratedDraft(previousTopUnderrated);
      setTopUnderratedError(error instanceof Error ? error.message : 'Unable to save top 3 underrated.');
    }
  }

  function openTopReturnStaysModal() {
    setTopReturnStaysDraft(topReturnStays);
    setTopReturnStaysError(null);
    setIsTopReturnStaysOpen(true);
  }

  async function handleSaveTopReturnStays() {
    const selectedHotelIds = topReturnStaysDraft.map((slot) => slot.hotelId).filter(Boolean);

    if (selectedHotelIds.length !== new Set(selectedHotelIds).size) {
      setTopReturnStaysError('Each return stay must be a different hotel.');
      return;
    }

    const nextTopReturnStays = topReturnStaysDraft.map((slot) => ({
      ...slot,
      imageUrl: slot.imageUrl.trim()
    }));

    const previousTopReturnStays = topReturnStays;

    setTopReturnStays(nextTopReturnStays);
    setTopReturnStaysDraft(nextTopReturnStays);
    setTopReturnStaysError(null);

    try {
      await persistDashboardPreferences({ topReturnStays: nextTopReturnStays });
      setIsTopReturnStaysOpen(false);
    } catch (error) {
      setTopReturnStays(previousTopReturnStays);
      setTopReturnStaysDraft(previousTopReturnStays);
      setTopReturnStaysError(error instanceof Error ? error.message : 'Unable to save top 3 return stays.');
    }
  }

  async function updateDisplayPreferences(nextDisplayPreferences: DisplayPreferences) {
    const previousDisplayPreferences = displayPreferences;
    setDisplayPreferences(nextDisplayPreferences);

    try {
      await persistDashboardPreferences({ displayPreferences: nextDisplayPreferences });
    } catch (error) {
      setDisplayPreferences(previousDisplayPreferences);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save dashboard preferences.');
    }
  }

  function getSectionOrder(sectionId: DashboardSectionId) {
    const index = displayPreferences.sectionOrder.indexOf(sectionId);
    return index >= 0 ? index + 1 : DEFAULT_SECTION_ORDER.indexOf(sectionId) + 1;
  }

  async function reorderSections(draggedId: DashboardSectionId, targetId: DashboardSectionId) {
    if (draggedId === targetId) {
      return;
    }

    const currentOrder = [...displayPreferences.sectionOrder];
    const draggedIndex = currentOrder.indexOf(draggedId);
    const targetIndex = currentOrder.indexOf(targetId);

    if (draggedIndex < 0 || targetIndex < 0) {
      return;
    }

    currentOrder.splice(draggedIndex, 1);
    currentOrder.splice(targetIndex, 0, draggedId);

    await updateDisplayPreferences({
      ...displayPreferences,
      sectionOrder: currentOrder
    });
  }

  async function resetDashboardLayout() {
    await updateDisplayPreferences({
      ...DEFAULT_DISPLAY_PREFERENCES,
      sectionOrder: [...DEFAULT_SECTION_ORDER]
    });
    setIsCompactMode(false);
    setIsTravelTimelineCompactMode(false);
  }

  function openCreateModal() {
    setDraft(DEFAULT_DRAFT);
    setErrorMessage(null);
    setModalState({ mode: 'create' });
  }

  function openEditModal(hotel: HotelRecord) {
    setDraft({
      name: hotel.name,
      brand: hotel.brand,
      stayType: hotel.stayType,
      tier: hotel.tier,
      roomEntries: hotel.roomEntries.length ? hotel.roomEntries : [],
      stayEntries: hotel.stayEntries.length ? hotel.stayEntries : [],
      bucketListLocation: hotel.bucketListLocation,
      bucketListImageUrl: hotel.bucketListImageUrl
    });
    setErrorMessage(null);
    setModalState({ mode: 'edit', hotelId: hotel.id });
  }

  function resetDragState() {
    draggedHotelIdRef.current = null;
    setDraggedHotelId(null);
    setDropTarget(null);
  }

  async function persistDelete(hotelId: string) {
    if (persistenceMode === 'local') {
      setHotels((currentHotels) => normalizeHotelCollection(currentHotels.filter((hotel) => hotel.id !== hotelId)));
      return;
    }

    const response = await fetch(`/api/hotels/${hotelId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const result = (await response.json()) as { message?: string };
      throw new Error(result.message || 'Unable to delete hotel.');
    }
  }

  async function persistCreate(payload: HotelDraft) {
    if (persistenceMode === 'local') {
      return createLocalHotel(payload);
    }

    const response = await fetch('/api/hotels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = (await response.json()) as { hotel?: HotelRecord; message?: string };

    if (!response.ok || !result.hotel) {
      throw new Error(result.message || 'Unable to save hotel.');
    }

    return normalizeHotelRecord(result.hotel);
  }

  async function persistUpdate(hotelId: string, payload: HotelDraft) {
    if (persistenceMode === 'local') {
      const existingHotel = hotels.find((hotel) => hotel.id === hotelId);

      if (!existingHotel) {
        throw new Error('Hotel could not be found.');
      }

      return normalizeHotelRecord({
        ...existingHotel,
        ...payload,
        updatedAt: new Date().toISOString()
      });
    }

    const response = await fetch(`/api/hotels/${hotelId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = (await response.json()) as { hotel?: HotelRecord; message?: string };

    if (!response.ok || !result.hotel) {
      throw new Error(result.message || 'Unable to update hotel.');
    }

    return normalizeHotelRecord(result.hotel);
  }

  async function persistHotelOrder(nextHotels: HotelRecord[]) {
    const orderedHotels = normalizeHotelCollection(nextHotels);

    if (persistenceMode === 'local') {
      setHotels(orderedHotels);
      resetDragState();
      return;
    }

    const previousHotels = hotels;
    const requestId = reorderRequestIdRef.current + 1;
    reorderRequestIdRef.current = requestId;

    setHotels(orderedHotels);
    resetDragState();
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/hotels/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hotels: orderedHotels.map((hotel) => ({
            id: hotel.id,
            stayType: hotel.stayType,
            tier: hotel.tier,
            position: hotel.position
          }))
        })
      });

      const result = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !result.ok) {
        throw new Error(result.message || 'Unable to reorder hotels.');
      }
    } catch (error) {
      if (requestId === reorderRequestIdRef.current) {
        setHotels(previousHotels);
      }
      setErrorMessage(error instanceof Error ? error.message : 'Unable to reorder hotels.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDropOnTarget(stayType: StayType, tier: Tier | null, beforeHotelId: string | null) {
    const activeDraggedHotelId = draggedHotelIdRef.current ?? draggedHotelId;

    if (!activeDraggedHotelId) {
      return;
    }

    const nextHotels = moveHotelInCollection(hotels, activeDraggedHotelId, stayType, tier, beforeHotelId);
    await persistHotelOrder(nextHotels);
  }

  async function handleDelete() {
    if (modalState?.mode !== 'edit') {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await persistDelete(modalState.hotelId);

      if (persistenceMode !== 'local') {
        startTransition(() => {
          setHotels((currentHotels) =>
            normalizeHotelCollection(currentHotels.filter((hotel) => hotel.id !== modalState.hotelId))
          );
        });
      }

      closeModal();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete hotel.');
    } finally {
      setIsSaving(false);
    }
  }

  function buildPayloadFromDraft(): HotelDraft {
    const cleanedRoomEntries = draft.roomEntries
      .map((entry) => ({
        label: entry.label.trim(),
        kind: entry.kind,
        imageUrl: entry.kind === 'SUITE' ? entry.imageUrl.trim() : '',
        stars: entry.kind === 'SUITE' ? entry.stars : null,
        withKelly: entry.kind === 'SUITE' ? entry.withKelly : false
      }))
      .filter((entry) => entry.label);

    return {
      name: draft.name.trim(),
      brand: draft.brand,
      stayType: draft.stayType,
      tier: draft.stayType === 'EXPLORED' ? draft.tier ?? 'S' : null,
      roomEntries: draft.stayType === 'BUCKET_LIST' ? [] : cleanedRoomEntries,
      stayEntries: draft.stayType !== 'BUCKET_LIST'
        ? draft.stayEntries
        .map((entry) => ({
          id: entry.id || crypto.randomUUID(),
          month: Number(entry.month),
          year: Number(entry.year),
          withKelly: entry.withKelly
        }))
        .filter(
          (entry) =>
            Number.isInteger(entry.month) &&
            entry.month >= 1 &&
            entry.month <= 12 &&
            Number.isInteger(entry.year) &&
            entry.year >= 1900
        )
        : [],
      bucketListLocation: draft.stayType === 'BUCKET_LIST' ? draft.bucketListLocation.trim() : '',
      bucketListImageUrl: draft.stayType === 'BUCKET_LIST' ? draft.bucketListImageUrl.trim() : ''
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = buildPayloadFromDraft();

    if (!payload.name) {
      setErrorMessage('Hotel name is required.');
      return;
    }

    if (payload.stayType === 'EXPLORED' && !payload.tier) {
      setErrorMessage('Select a tier.');
      return;
    }

    if (payload.stayType === 'FUTURE' && payload.stayEntries.length === 0) {
      setErrorMessage('Add at least one planned month and year for this future stay.');
      return;
    }

    if (payload.stayType === 'BUCKET_LIST' && !payload.bucketListLocation) {
      setErrorMessage('Add a location for this bucket-list hotel.');
      return;
    }

    if (payload.stayType === 'BUCKET_LIST' && !payload.bucketListImageUrl) {
      setErrorMessage('Add a photo URL for this bucket-list hotel.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      if (modalState?.mode === 'edit') {
        const updatedHotel = await persistUpdate(modalState.hotelId, payload);
        startTransition(() => {
          setHotels((currentHotels) =>
            normalizeHotelCollection(
              currentHotels.map((hotel) => (hotel.id === updatedHotel.id ? updatedHotel : hotel))
            )
          );
        });
      } else {
        const createdHotel = await persistCreate(payload);
        startTransition(() => {
          setHotels((currentHotels) => normalizeHotelCollection([...currentHotels, createdHotel]));
        });
      }

      closeModal();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save hotel.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleHotelClick(hotel: HotelRecord) {
    if (recentlyDraggedHotelId === hotel.id) {
      setRecentlyDraggedHotelId(null);
      return;
    }

    openEditModal(hotel);
  }

  function updateRoomEntry(index: number, updater: (entry: RoomEntry) => RoomEntry) {
    setDraft((current) => ({
      ...current,
      roomEntries: current.roomEntries.map((entry, entryIndex) =>
        entryIndex === index ? updater(entry) : entry
      )
    }));
  }

  function addRoomEntry() {
    setDraft((current) => ({
      ...current,
      roomEntries: [...current.roomEntries, { ...EMPTY_ROOM_ENTRY }]
    }));
  }

  function removeRoomEntry(index: number) {
    setDraft((current) => ({
      ...current,
      roomEntries: current.roomEntries.filter((_, entryIndex) => entryIndex !== index)
    }));
  }

  function updateStayEntry(index: number, updater: (entry: StayEntry) => StayEntry) {
    setDraft((current) => ({
      ...current,
      stayEntries: current.stayEntries.map((entry, entryIndex) =>
        entryIndex === index ? updater(entry) : entry
      )
    }));
  }

  function addStayEntry() {
    setDraft((current) => ({
      ...current,
      stayEntries: [...current.stayEntries, { ...EMPTY_STAY_ENTRY, id: crypto.randomUUID() }]
    }));
  }

  function removeStayEntry(index: number) {
    setDraft((current) => ({
      ...current,
      stayEntries: current.stayEntries.filter((_, entryIndex) => entryIndex !== index)
    }));
  }

  return (
    <main className="relative overflow-hidden px-3 py-4 sm:px-5 lg:px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_top_left,rgba(179,141,78,0.2),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,102,179,0.18),transparent_32%)]" />

      <div className="relative mx-auto flex max-w-[1500px] flex-col gap-4 pb-8">
        <section className="glass-panel relative overflow-hidden rounded-[30px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(true)}
                  className="section-label transition hover:text-[rgb(var(--wine))]"
                >
                  World of Hyatt
                </button>
                <h1 className="mt-3 max-w-3xl font-[family:var(--font-display)] text-3xl leading-none text-[rgb(var(--page-foreground))] sm:text-4xl lg:text-5xl">
                  My Hyatt Tier List
                </h1>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
                <button
                  type="button"
                  onClick={() => setIsTopOverviewOpen(true)}
                  className="inline-flex items-center justify-center rounded-full border border-[rgba(0,102,179,0.18)] bg-white/82 px-5 py-3 text-sm font-semibold text-[rgb(var(--wine))] shadow-[0_12px_24px_rgba(26,74,122,0.08)] transition hover:-translate-y-0.5 hover:bg-[rgba(0,102,179,0.06)]"
                  aria-label="Open all top 3 categories"
                >
                  All Top 3
                </button>
                <button
                  type="button"
                  onClick={() => setIsAllBrandsOpen(true)}
                  className="inline-flex items-center justify-center rounded-full border border-[rgba(0,102,179,0.18)] bg-white/82 px-5 py-3 text-sm font-semibold text-[rgb(var(--wine))] shadow-[0_12px_24px_rgba(26,74,122,0.08)] transition hover:-translate-y-0.5 hover:bg-[rgba(0,102,179,0.06)]"
                  aria-label="Open all Hyatt brands"
                >
                  Brands
                </button>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center justify-center rounded-full bg-[rgb(var(--wine))] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(26,74,122,0.22)] transition hover:-translate-y-0.5 hover:bg-[#004f8d]"
                >
                  Add hotel
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-5">
                {summaryCards.map((card) => (
                  <div key={card.label} className="soft-ring rounded-[20px] bg-white/82 p-3 sm:rounded-[24px] sm:p-4">
                    <div className="text-[0.62rem] uppercase tracking-[0.14em] text-[rgba(34,58,86,0.52)] sm:text-[0.72rem] sm:tracking-[0.16em]">
                      {card.label === 'Hotels Explored' ? (
                        <button
                          type="button"
                          onClick={scrollToTierBoard}
                          className="block w-full text-left align-top text-[0.62rem] uppercase tracking-[0.14em] text-[rgba(34,58,86,0.52)] transition hover:text-[rgb(var(--wine))] sm:text-[0.72rem] sm:tracking-[0.16em]"
                        >
                          {card.label}
                        </button>
                      ) : card.label === 'Brands Explored' ? (
                        <button
                          type="button"
                          onClick={() => setIsExploredBrandsOpen(true)}
                          className="block w-full text-left align-top text-[0.62rem] uppercase tracking-[0.14em] text-[rgba(34,58,86,0.52)] transition hover:text-[rgb(var(--wine))] sm:text-[0.72rem] sm:tracking-[0.16em]"
                        >
                          {card.label}
                        </button>
                      ) : card.label === 'Planned Hotel Explorations' ? (
                        <button
                          type="button"
                          onClick={scrollToFutureHotels}
                          className="block w-full text-left align-top text-[0.62rem] uppercase tracking-[0.14em] text-[rgba(34,58,86,0.52)] transition hover:text-[rgb(var(--wine))] sm:text-[0.72rem] sm:tracking-[0.16em]"
                        >
                          {card.label}
                        </button>
                      ) : card.label === 'Suites Explored' ? (
                        <button
                          type="button"
                          onClick={scrollToSuiteExplorations}
                          className="block w-full text-left align-top text-[0.62rem] uppercase tracking-[0.14em] text-[rgba(34,58,86,0.52)] transition hover:text-[rgb(var(--wine))] sm:text-[0.72rem] sm:tracking-[0.16em]"
                        >
                          {card.label}
                        </button>
                      ) : card.label === 'Planned Brand Explorations' ? (
                        <button
                          type="button"
                          onClick={() => setIsFutureBrandsOpen(true)}
                          className="block w-full text-left align-top text-[0.62rem] uppercase tracking-[0.14em] text-[rgba(34,58,86,0.52)] transition hover:text-[rgb(var(--wine))] sm:text-[0.72rem] sm:tracking-[0.16em]"
                        >
                          {card.label}
                        </button>
                      ) : (
                        card.label
                      )}
                    </div>
                    <div className="mt-1.5 text-lg font-semibold text-[rgb(var(--page-foreground))] sm:mt-2 sm:text-[1.75rem]">
                      {card.value}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </section>

        {displayPreferences.showTopHotels ? (
        <section className="glass-panel rounded-[28px] px-4 py-4 sm:px-5 sm:py-5" style={{ order: getSectionOrder('topHotels') }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <button
                type="button"
                onClick={openTopPicksModal}
                className="section-label transition hover:text-[rgb(var(--wine))]"
              >
                Top 3 Hotels
              </button>
              <h2 className="mt-2 text-2xl font-semibold text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-3xl">
                My Personal Podium
              </h2>
            </div>
          </div>

          {hasCompleteTopPicks ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {topPicksResolved.map((slot) => {
                const hotel = slot.hotel;

                if (!hotel) {
                  return null;
                }

                const brand = BRAND_BY_NAME[hotel.brand];
                const brandColor = brand?.color ?? '#1D4ED8';

                return (
                  <article
                    key={`${slot.rank}-${hotel.id}`}
                    className="relative overflow-hidden rounded-[28px] border border-white/50 bg-[rgba(255,255,255,0.82)] shadow-[0_20px_60px_rgba(26,74,122,0.16)]"
                  >
                    <div className="relative h-48 sm:h-52">
                      {slot.imageUrl ? (
                        <UserPhoto
                          src={slot.imageUrl}
                          alt={hotel.name}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{
                            background: `radial-gradient(circle at top left, ${brandColor}66, transparent 34%), linear-gradient(135deg, ${brandColor}26, rgba(18,42,68,0.18))`
                          }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(12,24,40,0.84)] via-[rgba(12,24,40,0.24)] to-transparent" />
                      <div className="absolute left-4 top-4 rounded-full border border-white/70 bg-[rgba(255,255,255,0.78)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--wine))] shadow-[0_10px_24px_rgba(12,24,40,0.18)] backdrop-blur-md">
                        No. {slot.rank}
                      </div>
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="text-2xl font-semibold leading-tight text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.42)]">
                          {hotel.name}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/58 p-5 text-sm text-[rgba(34,58,86,0.62)]">
              Click Top 3 Hotels to set up your personal podium.
            </div>
          )}
        </section>
        ) : null}

        {displayPreferences.showTopSuites ? (
        <section className="glass-panel rounded-[28px] px-4 py-4 sm:px-5 sm:py-5" style={{ order: getSectionOrder('topSuites') }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <button
                type="button"
                onClick={openTopSuitesModal}
                className="section-label transition hover:text-[rgb(var(--wine))]"
              >
                Top 3 Suites
              </button>
              <h2 className="mt-2 text-2xl font-semibold text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-3xl">
                My Personal Favorite
              </h2>
            </div>
          </div>

          {hasCompleteTopSuites ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {topSuitesResolved.map((slot) => {
                const hotel = slot.hotel;

                if (!hotel) {
                  return null;
                }

                const brand = BRAND_BY_NAME[hotel.brand];
                const brandColor = brand?.color ?? '#1D4ED8';

                return (
                  <article
                    key={`${slot.rank}-${hotel.id}-${slot.suiteName}`}
                    className="relative overflow-hidden rounded-[28px] border border-white/50 bg-[rgba(255,255,255,0.82)] shadow-[0_20px_60px_rgba(26,74,122,0.16)]"
                  >
                    <div className="relative h-48 sm:h-52">
                      {slot.imageUrl ? (
                        <UserPhoto
                          src={slot.imageUrl}
                          alt={`${hotel.name} ${slot.suiteName}`}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{
                            background: `radial-gradient(circle at top left, ${brandColor}66, transparent 34%), linear-gradient(135deg, ${brandColor}26, rgba(18,42,68,0.18))`
                          }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,18,32,0.92)] via-[rgba(12,24,40,0.34)] to-transparent" />
                      <div className="absolute left-4 top-4 rounded-full border border-white/70 bg-[rgba(255,255,255,0.78)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--wine))] shadow-[0_10px_24px_rgba(12,24,40,0.18)] backdrop-blur-md">
                        No. {slot.rank}
                      </div>
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="text-xl font-semibold leading-tight text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)]">
                          {hotel.name}
                        </div>
                        <div className="mt-2 inline-flex max-w-full rounded-full border border-white/20 bg-white/18 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
                          {slot.suiteName}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/58 p-5 text-sm text-[rgba(34,58,86,0.62)]">
              Click Top 3 Suites to set up your favorite suites.
            </div>
          )}
        </section>
        ) : null}

        {displayPreferences.showTierBoard ? (
        <section
          ref={tierBoardSectionRef}
          className="glass-panel rounded-[28px] px-4 py-4 sm:px-5 sm:py-5"
          style={{ order: getSectionOrder('tierBoard') }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="section-label">Tier Board</p>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="flex flex-col gap-3">
              {TIERS.map((tier) => {
                const tierHotels = hotelsByTier[tier];
                const tierStyle = TIER_STYLES[tier];

                return (
                  <section
                    key={tier}
                    onDragOver={(event) => {
                      if (!(draggedHotelIdRef.current ?? draggedHotelId)) {
                        return;
                      }

                      event.preventDefault();
                      setDropTarget(resolveDropTargetFromPointer(event, 'EXPLORED', tier));
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const target = resolveDropTargetFromPointer(event, 'EXPLORED', tier);
                      void handleDropOnTarget(target.stayType, target.tier, target.beforeHotelId);
                    }}
                    className={`tier-shell rounded-[24px] ${
                      isCompactMode ? 'min-h-[104px] bg-white/92 p-2.5 sm:min-h-[112px] sm:p-3' : `bg-gradient-to-r ${tierStyle.panel} p-3.5 sm:p-4`
                    }`}
                    style={{
                      outline:
                        dropTarget?.stayType === 'EXPLORED' && dropTarget.tier === tier
                          ? '2px solid rgba(0,102,179,0.18)'
                          : 'none',
                      outlineOffset: '3px'
                    }}
                  >
                    <div className={isCompactMode ? 'grid gap-2 md:grid-cols-[68px_minmax(0,1fr)] md:items-stretch' : ''}>
                      <div className={isCompactMode ? 'flex md:block' : 'flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'}>
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex shrink-0 items-center justify-center font-bold ${tierStyle.badge} ${
                              isCompactMode ? 'h-[56px] w-[56px] rounded-[18px] text-xl' : 'h-11 w-11 rounded-2xl text-lg'
                            }`}
                          >
                            {tier}
                          </div>
                          {!isCompactMode ? (
                            <div className="text-base font-semibold text-[rgb(var(--page-foreground))] sm:text-lg">
                              {tier}-Tier
                            </div>
                          ) : null}
                        </div>

                        {!isCompactMode ? (
                          <div className="rounded-full border border-white/80 bg-white/75 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[rgba(34,58,86,0.58)] sm:px-3 sm:text-xs sm:tracking-[0.18em]">
                            {tierHotels.length} hotel{tierHotels.length === 1 ? '' : 's'}
                          </div>
                        ) : null}
                      </div>

                      <div className={isCompactMode ? 'mt-2 flex min-h-[72px] flex-wrap content-start gap-1.5 md:mt-0 sm:min-h-[80px]' : 'mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5'}>
                      {tierHotels.length === 0 ? (
                        <div className="rounded-[18px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/55 p-4 text-sm text-[rgba(34,58,86,0.58)]">
                          {tierStyle.empty}
                        </div>
                      ) : (
                        tierHotels.map((hotel) => {
                          const brandColor = BRAND_BY_NAME[hotel.brand]?.color || '#7A1F2C';
                          const brandStyle = getBrandVisualStyle(hotel.brand, brandColor);

                          return (
                            <div
                              key={hotel.id}
                              data-hotel-id={hotel.id}
                              draggable
                              onDragStart={(event) => {
                                draggedHotelIdRef.current = hotel.id;
                                setDraggedHotelId(hotel.id);
                                setDropTarget({ stayType: 'EXPLORED', tier: hotel.tier, beforeHotelId: hotel.id });
                                setRecentlyDraggedHotelId(hotel.id);
                                event.dataTransfer.effectAllowed = 'move';
                                event.dataTransfer.setData('text/plain', hotel.id);
                              }}
                              onDragEnd={() => {
                                window.setTimeout(() => {
                                  setRecentlyDraggedHotelId(null);
                                }, 0);
                                resetDragState();
                              }}
                              onClick={() => handleHotelClick(hotel)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  handleHotelClick(hotel);
                                }
                              }}
                              aria-grabbed={draggedHotelId === hotel.id}
                              role="button"
                              tabIndex={0}
                              className={`group border-2 text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_26px_rgba(26,74,122,0.11)] ${
                                isCompactMode ? 'rounded-[10px] px-2.5 py-1.5' : 'min-h-[68px] rounded-[16px] px-3 py-2.5 sm:min-h-[72px]'
                              }`}
                              style={{
                                borderColor:
                                  dropTarget?.stayType === 'EXPLORED' &&
                                  dropTarget.tier === tier &&
                                  dropTarget.beforeHotelId === hotel.id
                                    ? `${brandColor}BB`
                                    : brandStyle.borderColor,
                                background: isCompactMode
                                  ? `linear-gradient(135deg, ${rgba(brandStyle.dotColor, 0.16)} 0%, rgba(255,255,255,0.96) 70%)`
                                  : brandStyle.background,
                                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.8), 0 14px 30px ${brandStyle.shadowColor}`,
                                opacity: draggedHotelId === hotel.id ? 0.55 : 1,
                                cursor: draggedHotelId === hotel.id ? 'grabbing' : 'grab'
                              }}
                            >
                              <div className={`flex ${isCompactMode ? 'items-center justify-start' : 'items-start justify-between'} gap-2.5`}>
                                <div>
                                  <div className={`text-[rgb(var(--page-foreground))] transition group-hover:text-[rgb(var(--wine))] ${
                                    isCompactMode
                                      ? 'whitespace-nowrap text-[0.72rem] font-semibold leading-none sm:text-xs'
                                      : 'line-clamp-2 text-[0.94rem] font-semibold leading-[1.3] sm:text-[0.98rem]'
                                  }`}>
                                    {hotel.name}
                                  </div>
                                </div>

                                {!isCompactMode ? (
                                  <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
                                    {hotel.roomEntries.length > 0 ? (
                                      <span
                                        className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full border border-[rgba(34,58,86,0.12)] bg-[rgba(34,58,86,0.08)] px-1 text-[0.55rem] font-semibold leading-none text-[rgba(34,58,86,0.72)]"
                                        aria-label={`${hotel.roomEntries.length} logged room${hotel.roomEntries.length === 1 ? '' : 's'}`}
                                      >
                                        {hotel.roomEntries.length}
                                      </span>
                                    ) : null}
                                    <span
                                      className="h-4.5 w-4.5 rounded-full border border-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
                                      style={{ backgroundColor: brandStyle.dotColor }}
                                      aria-label={`${hotel.brand} brand color`}
                                    />
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })
                      )}
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>

            <aside className="tier-shell rounded-[24px] bg-white/74 p-4">
              <button
                type="button"
                onClick={() => setIsExploredBrandsOpen(true)}
                className="section-label transition hover:text-[rgb(var(--wine))]"
              >
                Brands Explored
              </button>
              <div className="mt-3 flex flex-wrap gap-2.5 xl:flex-col xl:gap-2">
                {mappedBrands.length ? (
                  mappedBrands.map((brand) => (
                    (() => {
                      const brandStyle = getBrandVisualStyle(brand.name, brand.color);

                      return (
                    <button
                      key={brand.name}
                      type="button"
                      onClick={() => setSelectedBrandName(brand.name)}
                      className="inline-flex w-full items-start justify-start gap-2 rounded-full border px-3 py-2 text-left text-[0.65rem] font-semibold uppercase tracking-[0.1em] shadow-[0_10px_22px_rgba(26,74,122,0.06)] sm:text-xs sm:tracking-[0.12em]"
                      style={{
                        borderColor: brandStyle.borderColor,
                        background: brandStyle.background,
                        color: brandStyle.labelColor,
                        boxShadow: `0 10px 22px ${brandStyle.shadowColor}`
                      }}
                    >
                      <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: brandStyle.dotColor }} />
                      {brand.name}
                    </button>
                    );})()
                  ))
                ) : (
                  <div className="rounded-[18px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/55 p-4 text-sm text-[rgba(34,58,86,0.58)]">
                    No explored brands yet.
                  </div>
                )}
              </div>
            </aside>

          </div>
        </section>
        ) : null}

        {displayPreferences.showFutureHotels ? (
        <section
          ref={futureHotelsSectionRef}
          className="glass-panel rounded-[28px] px-4 py-4 sm:px-5 sm:py-5"
          style={{ order: getSectionOrder('futureHotels') }}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="section-label">Planned Hotel Explorations</p>
            </div>
            {!isCompactMode ? (
              <div className="rounded-full border border-white/80 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(34,58,86,0.58)]">
                {futureHotels.length} planned hotel exploration{futureHotels.length === 1 ? '' : 's'}
              </div>
            ) : null}
          </div>

          <div
            className={`mt-4 rounded-[24px] border border-dashed border-[rgba(0,102,179,0.14)] ${
              isCompactMode ? 'bg-white/78 p-2.5 sm:p-3' : 'bg-white/40 p-3 sm:p-4'
            }`}
          >
            <div className={isCompactMode ? 'flex min-h-[72px] flex-wrap content-start gap-1.5 sm:min-h-[80px]' : 'mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5'}>
              {futureHotels.length ? (
                futureHotels.map((hotel) => {
                  const brandColor = BRAND_BY_NAME[hotel.brand]?.color || '#7A1F2C';
                  const brandStyle = getBrandVisualStyle(hotel.brand, brandColor);
                  const plannedStay = getPrimaryFutureStayEntry(hotel);

                  return (
                    <div
                      key={hotel.id}
                      data-hotel-id={hotel.id}
                      onClick={() => handleHotelClick(hotel)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleHotelClick(hotel);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className={`group border-2 text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_26px_rgba(26,74,122,0.11)] ${
                        isCompactMode ? 'rounded-[10px] px-2.5 py-1.5' : 'min-h-[68px] rounded-[16px] px-3 py-2.5 sm:min-h-[72px]'
                      }`}
                      style={{
                        borderColor: brandStyle.borderColor,
                        background: isCompactMode
                          ? `linear-gradient(135deg, ${rgba(brandStyle.dotColor, 0.16)} 0%, rgba(255,255,255,0.96) 70%)`
                          : brandStyle.background,
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.8), 0 14px 30px ${brandStyle.shadowColor}`,
                        cursor: 'pointer'
                      }}
                    >
                      <div className={`flex ${isCompactMode ? 'items-center justify-start' : 'items-start justify-between'} gap-2.5`}>
                        <div>
                          <div className={`text-[rgb(var(--page-foreground))] transition group-hover:text-[rgb(var(--wine))] ${
                            isCompactMode
                              ? 'whitespace-nowrap text-[0.72rem] font-semibold leading-none sm:text-xs'
                              : 'line-clamp-2 text-[0.94rem] font-semibold leading-[1.3] sm:text-[0.98rem]'
                          }`}>
                            {hotel.name}
                          </div>
                          {!isCompactMode ? (
                            <div className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[rgba(34,58,86,0.58)]">
                              {formatMonthYear(plannedStay)}
                            </div>
                          ) : null}
                        </div>
                        {!isCompactMode ? (
                          <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
                            {hotel.roomEntries.length > 0 ? (
                              <span
                                className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full border border-[rgba(34,58,86,0.12)] bg-[rgba(34,58,86,0.08)] px-1 text-[0.55rem] font-semibold leading-none text-[rgba(34,58,86,0.72)]"
                                aria-label={`${hotel.roomEntries.length} logged room${hotel.roomEntries.length === 1 ? '' : 's'}`}
                              >
                                {hotel.roomEntries.length}
                              </span>
                            ) : null}
                            <span
                              className="h-4.5 w-4.5 rounded-full border border-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
                              style={{ backgroundColor: brandStyle.dotColor }}
                              aria-label={`${hotel.brand} brand color`}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[18px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/55 p-4 text-sm text-[rgba(34,58,86,0.58)]">
                  No planned hotel explorations yet.
                </div>
              )}
            </div>
          </div>
        </section>
        ) : null}

        {displayPreferences.showTravelTimeline ? (
        <section className="glass-panel rounded-[28px] px-4 py-4 sm:px-5 sm:py-5" style={{ order: getSectionOrder('travelTimeline') }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-label">My Travel Timeline</p>
            </div>
          </div>

          {travelTimelineYears.length ? (
            <div className="mt-5 space-y-5">
              {travelTimelineYears.map(({ year, stays }) => (
                <section key={year} className="rounded-[24px] border border-[rgba(0,102,179,0.12)] bg-white/56 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-2xl font-semibold text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-3xl">
                      {year}
                    </h3>
                    <div className="rounded-full border border-white/80 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(34,58,86,0.58)]">
                      {stays.length} stay{stays.length === 1 ? '' : 's'}
                    </div>
                  </div>

                  <div className={isTravelTimelineCompactMode ? 'mt-4 flex min-h-[72px] flex-wrap content-start gap-1.5 sm:min-h-[80px]' : 'mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5'}>
                    {stays.map((stay) => {
                      const brandColor = BRAND_BY_NAME[stay.hotel.brand]?.color || '#7A1F2C';
                      const brandStyle = getBrandVisualStyle(stay.hotel.brand, brandColor);

                      return (
                        <div
                          key={`${stay.hotel.id}-${stay.id}`}
                          onClick={() => handleHotelClick(stay.hotel)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleHotelClick(stay.hotel);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          className={`group border-2 text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_26px_rgba(26,74,122,0.11)] ${
                            isTravelTimelineCompactMode ? 'rounded-[10px] px-2.5 py-1.5' : 'min-h-[68px] rounded-[16px] px-3 py-2.5 sm:min-h-[72px]'
                          }`}
                          style={{
                            borderColor: brandStyle.borderColor,
                            background: isTravelTimelineCompactMode
                              ? `linear-gradient(135deg, ${rgba(brandStyle.dotColor, 0.16)} 0%, rgba(255,255,255,0.96) 70%)`
                              : brandStyle.background,
                            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.8), 0 14px 30px ${brandStyle.shadowColor}`
                          }}
                        >
                          <div className={`flex ${isTravelTimelineCompactMode ? 'items-center justify-start' : 'items-start justify-between'} gap-2.5`}>
                            <div>
                              <div className={`text-[rgb(var(--page-foreground))] transition group-hover:text-[rgb(var(--wine))] ${
                                isTravelTimelineCompactMode
                                  ? 'whitespace-nowrap text-[0.72rem] font-semibold leading-none sm:text-xs'
                                  : 'line-clamp-2 text-[0.94rem] font-semibold leading-[1.3] sm:text-[0.98rem]'
                              }`}>
                                {stay.hotel.name}
                              </div>
                              {!isTravelTimelineCompactMode ? (
                                <div className="mt-2 inline-flex rounded-full border border-[rgba(34,58,86,0.12)] bg-[rgba(255,255,255,0.78)] px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[rgba(34,58,86,0.62)]">
                                  {MONTH_LABELS[stay.month - 1]}
                                </div>
                              ) : null}
                            </div>

                            {isTravelTimelineCompactMode ? (
                              <div className="ml-2 inline-flex rounded-full border border-[rgba(34,58,86,0.12)] bg-[rgba(255,255,255,0.78)] px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-[rgba(34,58,86,0.62)]">
                                {MONTH_LABELS[stay.month - 1].slice(0, 3)}
                              </div>
                            ) : (
                              <span
                                className="mt-0.5 h-4.5 w-4.5 rounded-full border border-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
                                style={{ backgroundColor: brandStyle.dotColor }}
                                aria-label={`${stay.hotel.brand} brand color`}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/58 p-5 text-sm text-[rgba(34,58,86,0.62)]">
              Add month and year entries to explored hotels to build your travel timeline.
            </div>
          )}
        </section>
        ) : null}

        {displayPreferences.showSuiteSlideshow ? (
        <section
          ref={suiteExplorationsSectionRef}
          className="glass-panel rounded-[28px] px-4 py-4 sm:px-5 sm:py-5"
          style={{ order: getSectionOrder('suiteSlideshow') }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <button
                type="button"
                onClick={openSuitePickerModal}
                className="section-label transition hover:text-[rgb(var(--wine))]"
              >
                My Suite Explorations
              </button>
            </div>

            {loggedSuiteSlides.length ? (
              <div className="rounded-full border border-white/80 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(34,58,86,0.58)]">
                {activeSuiteSlideIndex + 1} / {loggedSuiteSlides.length}
              </div>
            ) : null}
          </div>

          {activeSuiteSlide ? (
            <div className="mt-5 space-y-4">
              <article className="overflow-hidden rounded-[36px] border border-white/8 bg-[#0a121b] shadow-[0_28px_80px_rgba(8,25,43,0.38)]">
                <div
                  className="relative min-h-[480px] bg-[#0a121b] sm:min-h-[720px]"
                  onPointerDown={(event) => {
                    suiteSwipeStartXRef.current = event.clientX;
                    suiteSwipeDeltaXRef.current = 0;
                  }}
                  onPointerMove={(event) => {
                    if (suiteSwipeStartXRef.current === null) {
                      return;
                    }

                    suiteSwipeDeltaXRef.current = event.clientX - suiteSwipeStartXRef.current;
                  }}
                  onPointerUp={() => {
                    if (suiteSwipeStartXRef.current === null) {
                      return;
                    }

                    if (suiteSwipeDeltaXRef.current <= -50) {
                      showNextSuiteSlide();
                    } else if (suiteSwipeDeltaXRef.current >= 50) {
                      showPreviousSuiteSlide();
                    }

                    suiteSwipeStartXRef.current = null;
                    suiteSwipeDeltaXRef.current = 0;
                  }}
                  onPointerCancel={() => {
                    suiteSwipeStartXRef.current = null;
                    suiteSwipeDeltaXRef.current = 0;
                  }}
                  onPointerLeave={() => {
                    suiteSwipeStartXRef.current = null;
                    suiteSwipeDeltaXRef.current = 0;
                  }}
                >
                  {activeSuiteSlide.imageUrl ? (
                    <UserPhoto
                      src={activeSuiteSlide.imageUrl}
                      alt={`${activeSuiteSlide.hotel.name} ${activeSuiteSlide.suiteName}`}
                      eager
                      className="absolute inset-0 h-full w-full object-cover scale-[1.08] blur-[10px] opacity-35"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(95,130,162,0.2),transparent_48%),linear-gradient(135deg,rgba(16,27,40,0.98),rgba(10,18,27,1))]" />
                  )}

                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_42%),linear-gradient(180deg,rgba(6,14,22,0.18),rgba(6,14,22,0.66)_52%,rgba(6,14,22,0.92))]" />

                  <button
                    type="button"
                    onClick={showPreviousSuiteSlide}
                    className="absolute left-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/18 bg-[rgba(255,255,255,0.1)] text-lg font-semibold text-white backdrop-blur-md transition hover:bg-[rgba(255,255,255,0.18)] sm:left-6 sm:h-12 sm:w-12"
                    aria-label="Show previous suite"
                  >
                    ←
                  </button>

                  <button
                    type="button"
                    onClick={showNextSuiteSlide}
                    className="absolute right-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/18 bg-[rgba(255,255,255,0.1)] text-lg font-semibold text-white backdrop-blur-md transition hover:bg-[rgba(255,255,255,0.18)] sm:right-6 sm:h-12 sm:w-12"
                    aria-label="Show next suite"
                  >
                    →
                  </button>

                  <div className="absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 items-center justify-center gap-4 px-3 sm:gap-10 sm:px-8 lg:px-10">
                    {previousSuiteSlide ? (
                      <button
                        type="button"
                        onClick={showPreviousSuiteSlide}
                        className="group relative hidden h-[300px] w-[190px] shrink-0 overflow-hidden rounded-[26px] border border-white/10 shadow-[0_22px_40px_rgba(0,0,0,0.28)] transition hover:-translate-x-1 hover:border-white/18 sm:block md:h-[430px] md:w-[280px] lg:h-[520px] lg:w-[320px] xl:-ml-14"
                        aria-label={`Preview previous suite: ${previousSuiteSlide.suiteName}`}
                      >
                        {previousSuiteSlide.imageUrl ? (
                          <UserPhoto
                            src={previousSuiteSlide.imageUrl}
                            alt={`${previousSuiteSlide.hotel.name} ${previousSuiteSlide.suiteName}`}
                            className="absolute inset-0 h-full w-full object-cover grayscale-[0.18] opacity-70 transition group-hover:opacity-82"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(126,138,149,0.45),rgba(43,54,67,0.9))]" />
                        )}
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,18,28,0.16),rgba(7,18,28,0.82))]" />
                      </button>
                    ) : null}

                    <div className="relative h-[340px] w-[320px] shrink-0 overflow-hidden rounded-[30px] border border-white/14 shadow-[0_30px_70px_rgba(0,0,0,0.34)] sm:h-[440px] sm:w-[470px] md:h-[520px] md:w-[640px] lg:h-[560px] lg:w-[760px] xl:h-[600px] xl:w-[860px]">
                      {activeSuiteSlide.imageUrl ? (
                        <UserPhoto
                          src={activeSuiteSlide.imageUrl}
                          alt={`${activeSuiteSlide.hotel.name} ${activeSuiteSlide.suiteName}`}
                          eager
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(147,176,200,0.78),rgba(41,56,71,0.98))]" />
                      )}

                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,10,0.03),rgba(10,10,10,0.16)_28%,rgba(10,10,10,0.72))]" />

                      <div className="absolute left-3 top-3 sm:left-4 sm:top-4">
                        <div className="inline-flex items-center rounded-full border border-white/16 bg-[rgba(8,16,26,0.58)] px-3 py-1.5 text-[0.84rem] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.2)] backdrop-blur-md">
                          {activeSuiteSlide.hotel.brand}
                        </div>
                      </div>

                      <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4">
                        <div className="w-[60%] max-w-[520px] min-w-[250px] rounded-[24px] border border-white/8 bg-[linear-gradient(145deg,rgba(24,24,24,0.1),rgba(24,24,24,0.22))] p-4 shadow-[0_18px_38px_rgba(0,0,0,0.1)] backdrop-blur-sm sm:max-w-[560px] sm:p-5">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-[rgba(255,255,255,0.14)] px-3 py-1.75 text-[0.92rem] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
                              <span aria-hidden="true">⭐</span>
                              <span>{activeSuiteSlide.stars ? `${activeSuiteSlide.stars}/5 Stars` : 'Not Rated'}</span>
                            </div>
                          </div>
                          <div className="mt-3 truncate text-xl font-semibold leading-tight text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)] sm:text-[2rem]">
                            {activeSuiteSlide.suiteName}
                          </div>
                          <div className="mt-2 truncate text-sm font-medium uppercase tracking-[0.14em] text-white/90 drop-shadow-[0_3px_8px_rgba(0,0,0,0.45)] sm:text-[0.9rem]">
                            {activeSuiteSlide.hotel.name}
                          </div>
                        </div>
                      </div>
                    </div>

                    {nextSuiteSlide ? (
                      <button
                        type="button"
                        onClick={showNextSuiteSlide}
                        className="group relative hidden h-[300px] w-[190px] shrink-0 overflow-hidden rounded-[26px] border border-white/10 shadow-[0_22px_40px_rgba(0,0,0,0.28)] transition hover:translate-x-1 hover:border-white/18 sm:block md:h-[430px] md:w-[280px] lg:h-[520px] lg:w-[320px] xl:-mr-14"
                        aria-label={`Preview next suite: ${nextSuiteSlide.suiteName}`}
                      >
                        {nextSuiteSlide.imageUrl ? (
                          <UserPhoto
                            src={nextSuiteSlide.imageUrl}
                            alt={`${nextSuiteSlide.hotel.name} ${nextSuiteSlide.suiteName}`}
                            className="absolute inset-0 h-full w-full object-cover grayscale-[0.18] opacity-70 transition group-hover:opacity-82"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(126,138,149,0.45),rgba(43,54,67,0.9))]" />
                        )}
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,18,28,0.16),rgba(7,18,28,0.82))]" />
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-4 p-4 sm:p-5">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(0,102,179,0.08)]">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#7a1f2c,#c38a52)] transition-[width] duration-300"
                      style={{ width: `${((activeSuiteSlideIndex + 1) / loggedSuiteSlides.length) * 100}%` }}
                    />
                  </div>
                </div>
              </article>
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/58 p-5 text-sm text-[rgba(34,58,86,0.62)]">
              Add suite entries with an image URL to explored hotels and they will appear here.
            </div>
          )}
        </section>
        ) : null}

        {displayPreferences.showBucketListSlideshow ? (
        <section
          ref={bucketListSectionRef}
          className="glass-panel rounded-[28px] px-4 py-4 sm:px-5 sm:py-5"
          style={{ order: getSectionOrder('bucketListSlideshow') }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <button
                type="button"
                onClick={openBucketListPickerModal}
                className="section-label transition hover:text-[rgb(var(--wine))]"
              >
                My Hyatt Bucket List
              </button>
            </div>

            {bucketListSlides.length ? (
              <div className="rounded-full border border-white/80 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(34,58,86,0.58)]">
                {activeBucketListSlideIndex + 1} / {bucketListSlides.length}
              </div>
            ) : null}
          </div>

          {activeBucketListSlide ? (
            <div className="mt-5 space-y-4">
              <article className="overflow-hidden rounded-[36px] border border-white/8 bg-[#0a121b] shadow-[0_28px_80px_rgba(8,25,43,0.38)]">
                <div
                  className="relative min-h-[480px] bg-[#0a121b] sm:min-h-[720px]"
                  onPointerDown={(event) => {
                    bucketListSwipeStartXRef.current = event.clientX;
                    bucketListSwipeDeltaXRef.current = 0;
                  }}
                  onPointerMove={(event) => {
                    if (bucketListSwipeStartXRef.current === null) {
                      return;
                    }

                    bucketListSwipeDeltaXRef.current = event.clientX - bucketListSwipeStartXRef.current;
                  }}
                  onPointerUp={() => {
                    if (bucketListSwipeStartXRef.current === null) {
                      return;
                    }

                    if (bucketListSwipeDeltaXRef.current <= -50) {
                      showNextBucketListSlide();
                    } else if (bucketListSwipeDeltaXRef.current >= 50) {
                      showPreviousBucketListSlide();
                    }

                    bucketListSwipeStartXRef.current = null;
                    bucketListSwipeDeltaXRef.current = 0;
                  }}
                  onPointerCancel={() => {
                    bucketListSwipeStartXRef.current = null;
                    bucketListSwipeDeltaXRef.current = 0;
                  }}
                  onPointerLeave={() => {
                    bucketListSwipeStartXRef.current = null;
                    bucketListSwipeDeltaXRef.current = 0;
                  }}
                >
                  <UserPhoto
                    src={activeBucketListSlide.imageUrl}
                    alt={`${activeBucketListSlide.hotel.name} in ${activeBucketListSlide.location}`}
                    eager
                    className="absolute inset-0 h-full w-full object-cover scale-[1.08] blur-[10px] opacity-35"
                  />

                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_42%),linear-gradient(180deg,rgba(6,14,22,0.18),rgba(6,14,22,0.66)_52%,rgba(6,14,22,0.92))]" />

                  <button
                    type="button"
                    onClick={showPreviousBucketListSlide}
                    className="absolute left-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/18 bg-[rgba(255,255,255,0.1)] text-lg font-semibold text-white backdrop-blur-md transition hover:bg-[rgba(255,255,255,0.18)] sm:left-6 sm:h-12 sm:w-12"
                    aria-label="Show previous bucket-list hotel"
                  >
                    ←
                  </button>

                  <button
                    type="button"
                    onClick={showNextBucketListSlide}
                    className="absolute right-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/18 bg-[rgba(255,255,255,0.1)] text-lg font-semibold text-white backdrop-blur-md transition hover:bg-[rgba(255,255,255,0.18)] sm:right-6 sm:h-12 sm:w-12"
                    aria-label="Show next bucket-list hotel"
                  >
                    →
                  </button>

                  <div className="absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 items-center justify-center gap-4 px-3 sm:gap-10 sm:px-8 lg:px-10">
                    {previousBucketListSlide ? (
                      <button
                        type="button"
                        onClick={showPreviousBucketListSlide}
                        className="group relative hidden h-[300px] w-[190px] shrink-0 overflow-hidden rounded-[26px] border border-white/10 shadow-[0_22px_40px_rgba(0,0,0,0.28)] transition hover:-translate-x-1 hover:border-white/18 sm:block md:h-[430px] md:w-[280px] lg:h-[520px] lg:w-[320px] xl:-ml-14"
                        aria-label={`Preview previous bucket-list hotel: ${previousBucketListSlide.hotel.name}`}
                      >
                        <UserPhoto
                          src={previousBucketListSlide.imageUrl}
                          alt={`${previousBucketListSlide.hotel.name} in ${previousBucketListSlide.location}`}
                          className="absolute inset-0 h-full w-full object-cover grayscale-[0.18] opacity-70 transition group-hover:opacity-82"
                        />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,18,28,0.16),rgba(7,18,28,0.82))]" />
                      </button>
                    ) : null}

                    <div className="relative h-[340px] w-[320px] shrink-0 overflow-hidden rounded-[30px] border border-white/14 shadow-[0_30px_70px_rgba(0,0,0,0.34)] sm:h-[440px] sm:w-[470px] md:h-[520px] md:w-[640px] lg:h-[560px] lg:w-[760px] xl:h-[600px] xl:w-[860px]">
                      <UserPhoto
                        src={activeBucketListSlide.imageUrl}
                        alt={`${activeBucketListSlide.hotel.name} in ${activeBucketListSlide.location}`}
                        eager
                        className="absolute inset-0 h-full w-full object-cover"
                      />

                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,10,0.03),rgba(10,10,10,0.16)_28%,rgba(10,10,10,0.72))]" />

                      <div className="absolute left-3 top-3 sm:left-4 sm:top-4">
                        <div className="inline-flex items-center rounded-full border border-white/16 bg-[rgba(8,16,26,0.58)] px-3 py-1.5 text-[0.84rem] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.2)] backdrop-blur-md">
                          {activeBucketListSlide.hotel.brand}
                        </div>
                      </div>

                      <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4">
                        <div className="w-[60%] max-w-[520px] min-w-[250px] rounded-[24px] border border-white/8 bg-[linear-gradient(145deg,rgba(24,24,24,0.1),rgba(24,24,24,0.22))] p-4 shadow-[0_18px_38px_rgba(0,0,0,0.1)] backdrop-blur-sm sm:max-w-[560px] sm:p-5">
                          <h2 className="text-2xl font-semibold leading-tight text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.35)] sm:text-4xl">
                            {activeBucketListSlide.hotel.name}
                          </h2>
                          <p className="mt-2 text-sm font-medium uppercase tracking-[0.16em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)] sm:text-base">
                            {activeBucketListSlide.location}
                          </p>
                        </div>
                      </div>
                    </div>

                    {nextBucketListSlide ? (
                      <button
                        type="button"
                        onClick={showNextBucketListSlide}
                        className="group relative hidden h-[300px] w-[190px] shrink-0 overflow-hidden rounded-[26px] border border-white/10 shadow-[0_22px_40px_rgba(0,0,0,0.28)] transition hover:translate-x-1 hover:border-white/18 sm:block md:h-[430px] md:w-[280px] lg:h-[520px] lg:w-[320px] xl:-mr-14"
                        aria-label={`Preview next bucket-list hotel: ${nextBucketListSlide.hotel.name}`}
                      >
                        <UserPhoto
                          src={nextBucketListSlide.imageUrl}
                          alt={`${nextBucketListSlide.hotel.name} in ${nextBucketListSlide.location}`}
                          className="absolute inset-0 h-full w-full object-cover grayscale-[0.18] opacity-70 transition group-hover:opacity-82"
                        />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,18,28,0.16),rgba(7,18,28,0.82))]" />
                      </button>
                    ) : null}
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-4 sm:px-6 sm:pb-6">
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/12">
                      <div
                        className="h-full rounded-full bg-white/72 transition-[width] duration-300"
                        style={{ width: `${((activeBucketListSlideIndex + 1) / bucketListSlides.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </article>
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/58 p-5 text-sm text-[rgba(34,58,86,0.62)]">
              Add a bucket-list hotel with a location and photo URL to build this carousel.
            </div>
          )}
        </section>
        ) : null}

        {displayPreferences.showKellyExplorations ? (
        <section className="glass-panel rounded-[28px] px-4 py-4 sm:px-5 sm:py-5" style={{ order: getSectionOrder('kellyExplorations') }}>
          <div>
            <p className="section-label">My Hyatt Exploration with Kelly ❤️❤️</p>
          </div>

          {kellyExplorationHotels.length ? (
            <div className="mt-5 space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                <button
                  type="button"
                  onClick={openKellyHotelsPickerModal}
                  className="rounded-[24px] border border-white/50 bg-[rgba(255,255,255,0.82)] p-4 text-left shadow-[0_18px_40px_rgba(26,74,122,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_48px_rgba(26,74,122,0.16)]"
                >
                  <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[rgba(34,58,86,0.54)]">
                    Hotels Explored Together
                  </div>
                  <div className="mt-3 text-3xl font-semibold text-[rgb(var(--page-foreground))] sm:text-4xl">
                    {kellyExplorationHotels.length}
                  </div>
                </button>

                <article className="rounded-[24px] border border-white/50 bg-[rgba(255,255,255,0.82)] p-4 shadow-[0_18px_40px_rgba(26,74,122,0.12)]">
                  <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[rgba(34,58,86,0.54)]">
                    Suites Explored Together
                  </div>
                  <div className="mt-3 text-3xl font-semibold text-[rgb(var(--page-foreground))] sm:text-4xl">
                    {kellySuiteCount}
                  </div>
                </article>

                <button
                  type="button"
                  onClick={() => setIsKellyBrandsOpen(true)}
                  className="rounded-[24px] border border-white/50 bg-[rgba(255,255,255,0.82)] p-4 text-left shadow-[0_18px_40px_rgba(26,74,122,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_48px_rgba(26,74,122,0.16)]"
                >
                  <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[rgba(34,58,86,0.54)]">
                    Brands Explored Together
                  </div>
                  <div className="mt-3 text-3xl font-semibold text-[rgb(var(--page-foreground))] sm:text-4xl">
                    {kellyExploredBrandNames.size}
                  </div>
                </button>
              </div>

              {activeKellySuiteSlide ? (
                <article className="overflow-hidden rounded-[32px] border border-white/8 bg-[#0a121b] shadow-[0_28px_80px_rgba(8,25,43,0.28)]">
                  <div className="relative min-h-[480px] bg-[#0a121b] sm:min-h-[720px]">
                    {activeKellySuiteSlide.imageUrl ? (
                      <UserPhoto
                        src={activeKellySuiteSlide.imageUrl}
                        alt={`${activeKellySuiteSlide.hotel.name} ${activeKellySuiteSlide.suiteName}`}
                        eager
                        className="absolute inset-0 h-full w-full object-cover scale-[1.08] blur-[10px] opacity-35"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(95,130,162,0.2),transparent_48%),linear-gradient(135deg,rgba(16,27,40,0.98),rgba(10,18,27,1))]" />
                    )}

                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_42%),linear-gradient(180deg,rgba(6,14,22,0.18),rgba(6,14,22,0.66)_52%,rgba(6,14,22,0.92))]" />

                    {kellySuiteSlides.length > 1 ? (
                      <>
                        <button
                          type="button"
                          onClick={showPreviousKellySuiteSlide}
                          className="absolute left-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/18 bg-[rgba(255,255,255,0.1)] text-lg font-semibold text-white backdrop-blur-md transition hover:bg-[rgba(255,255,255,0.18)] sm:left-6 sm:h-12 sm:w-12"
                          aria-label="Show previous Kelly suite"
                        >
                          ←
                        </button>

                        <button
                          type="button"
                          onClick={showNextKellySuiteSlide}
                          className="absolute right-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/18 bg-[rgba(255,255,255,0.1)] text-lg font-semibold text-white backdrop-blur-md transition hover:bg-[rgba(255,255,255,0.18)] sm:right-6 sm:h-12 sm:w-12"
                          aria-label="Show next Kelly suite"
                        >
                          →
                        </button>
                      </>
                    ) : null}

                    <div className="absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 items-center justify-center gap-4 px-3 sm:gap-10 sm:px-8 lg:px-10">
                      {previousKellySuiteSlide ? (
                        <button
                          type="button"
                          onClick={showPreviousKellySuiteSlide}
                          className="group relative hidden h-[300px] w-[190px] shrink-0 overflow-hidden rounded-[26px] border border-white/10 shadow-[0_22px_40px_rgba(0,0,0,0.28)] transition hover:-translate-x-1 hover:border-white/18 sm:block md:h-[430px] md:w-[280px] lg:h-[520px] lg:w-[320px] xl:-ml-14"
                          aria-label={`Preview previous Kelly suite: ${previousKellySuiteSlide.suiteName}`}
                        >
                          {previousKellySuiteSlide.imageUrl ? (
                            <UserPhoto
                              src={previousKellySuiteSlide.imageUrl}
                              alt={`${previousKellySuiteSlide.hotel.name} ${previousKellySuiteSlide.suiteName}`}
                              className="absolute inset-0 h-full w-full object-cover grayscale-[0.18] opacity-70 transition group-hover:opacity-82"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(126,138,149,0.45),rgba(43,54,67,0.9))]" />
                          )}
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,18,28,0.16),rgba(7,18,28,0.82))]" />
                        </button>
                      ) : null}

                      <div className="relative h-[340px] w-[320px] shrink-0 overflow-hidden rounded-[30px] border border-white/14 shadow-[0_30px_70px_rgba(0,0,0,0.34)] sm:h-[440px] sm:w-[470px] md:h-[520px] md:w-[640px] lg:h-[560px] lg:w-[760px] xl:h-[600px] xl:w-[860px]">
                        {activeKellySuiteSlide.imageUrl ? (
                          <UserPhoto
                            src={activeKellySuiteSlide.imageUrl}
                            alt={`${activeKellySuiteSlide.hotel.name} ${activeKellySuiteSlide.suiteName}`}
                            eager
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(147,176,200,0.78),rgba(41,56,71,0.98))]" />
                        )}

                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,10,0.03),rgba(10,10,10,0.16)_28%,rgba(10,10,10,0.72))]" />

                        <div className="absolute left-3 top-3 sm:left-4 sm:top-4">
                          <div className="inline-flex items-center rounded-full border border-white/16 bg-[rgba(8,16,26,0.58)] px-3 py-1.5 text-[0.84rem] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.2)] backdrop-blur-md">
                            {activeKellySuiteSlide.hotel.brand}
                          </div>
                        </div>

                        <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4">
                          <div className="w-[60%] max-w-[520px] min-w-[250px] rounded-[24px] border border-white/8 bg-[linear-gradient(145deg,rgba(24,24,24,0.1),rgba(24,24,24,0.22))] p-4 shadow-[0_18px_38px_rgba(0,0,0,0.1)] backdrop-blur-sm sm:max-w-[560px] sm:p-5">
                            <div className="mt-0 text-xl font-semibold leading-tight text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)] sm:text-[2rem]">
                              {activeKellySuiteSlide.suiteName}
                            </div>
                            <div className="mt-2 text-sm font-medium uppercase tracking-[0.14em] text-white/90 drop-shadow-[0_3px_8px_rgba(0,0,0,0.45)] sm:text-[0.9rem]">
                              {activeKellySuiteSlide.hotel.name}
                            </div>
                          </div>
                        </div>
                      </div>

                      {nextKellySuiteSlide ? (
                        <button
                          type="button"
                          onClick={showNextKellySuiteSlide}
                          className="group relative hidden h-[300px] w-[190px] shrink-0 overflow-hidden rounded-[26px] border border-white/10 shadow-[0_22px_40px_rgba(0,0,0,0.28)] transition hover:translate-x-1 hover:border-white/18 sm:block md:h-[430px] md:w-[280px] lg:h-[520px] lg:w-[320px] xl:-mr-14"
                          aria-label={`Preview next Kelly suite: ${nextKellySuiteSlide.suiteName}`}
                        >
                          {nextKellySuiteSlide.imageUrl ? (
                            <UserPhoto
                              src={nextKellySuiteSlide.imageUrl}
                              alt={`${nextKellySuiteSlide.hotel.name} ${nextKellySuiteSlide.suiteName}`}
                              className="absolute inset-0 h-full w-full object-cover grayscale-[0.18] opacity-70 transition group-hover:opacity-82"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(126,138,149,0.45),rgba(43,54,67,0.9))]" />
                          )}
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,18,28,0.16),rgba(7,18,28,0.82))]" />
                        </button>
                      ) : null}
                    </div>

                    {kellySuiteSlides.length ? (
                      <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-4 sm:px-6 sm:pb-6">
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/12">
                          <div
                            className="h-full rounded-full bg-white/72 transition-[width] duration-300"
                            style={{ width: `${((activeKellySuiteSlideIndex + 1) / kellySuiteSlides.length) * 100}%` }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </article>
              ) : (
                <div className="rounded-[22px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/58 p-5 text-sm text-[rgba(34,58,86,0.62)]">
                  Mark explored stays and suite entries with Kelly ❤️ to build this shared suite carousel.
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/58 p-5 text-sm text-[rgba(34,58,86,0.62)]">
              Open any explored hotel and mark individual stays or suites with Kelly ❤️ to start building this section.
            </div>
          )}
        </section>
        ) : null}

        {displayPreferences.showTopFutureStays ? (
        <section className="glass-panel rounded-[28px] px-4 py-4 sm:px-5 sm:py-5" style={{ order: getSectionOrder('topFutureStays') }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <button
                type="button"
                onClick={openTopFutureStaysModal}
                className="section-label transition hover:text-[rgb(var(--wine))]"
              >
                Top 3 Future Stays
              </button>
              <h2 className="mt-2 text-2xl font-semibold text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-3xl">
                My Most Anticipated
              </h2>
            </div>
          </div>

          {hasCompleteTopFutureStays ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {topFutureStaysResolved.map((slot) => {
                const hotel = slot.hotel;

                if (!hotel) {
                  return null;
                }

                const brandColor = BRAND_BY_NAME[hotel.brand]?.color ?? '#1D4ED8';

                return (
                  <article
                    key={`${slot.rank}-${hotel.id}`}
                    className="relative overflow-hidden rounded-[28px] border border-white/50 bg-[rgba(255,255,255,0.82)] shadow-[0_20px_60px_rgba(26,74,122,0.16)]"
                  >
                    <div className="relative h-48 sm:h-52">
                      {slot.imageUrl ? (
                        <UserPhoto
                          src={slot.imageUrl}
                          alt={hotel.name}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{
                            background: `radial-gradient(circle at top left, ${brandColor}66, transparent 34%), linear-gradient(135deg, ${brandColor}26, rgba(18,42,68,0.18))`
                          }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,18,32,0.92)] via-[rgba(12,24,40,0.3)] to-transparent" />
                      <div className="absolute left-4 top-4 rounded-full border border-white/70 bg-[rgba(255,255,255,0.78)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--wine))] shadow-[0_10px_24px_rgba(12,24,40,0.18)] backdrop-blur-md">
                        No. {slot.rank}
                      </div>
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="text-xl font-semibold leading-tight text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)]">
                          {hotel.name}
                        </div>
                        <div className="mt-2 inline-flex max-w-full rounded-full border border-white/20 bg-white/18 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
                          {slot.location}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/58 p-5 text-sm text-[rgba(34,58,86,0.62)]">
              Click Top 3 Future Stays to set up your most anticipated hotels.
            </div>
          )}
        </section>
        ) : null}

        {displayPreferences.showTopExperiences ? (
        <section className="glass-panel rounded-[28px] px-4 py-4 sm:px-5 sm:py-5" style={{ order: getSectionOrder('topExperiences') }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <button
                type="button"
                onClick={openTopExperiencesModal}
                className="section-label transition hover:text-[rgb(var(--wine))]"
              >
                Top 3 Experiences
              </button>
              <h2 className="mt-2 text-2xl font-semibold text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-3xl">
                My Most Memorable
              </h2>
            </div>
          </div>

          {hasCompleteTopExperiences ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {topExperiencesResolved.map((slot) => {
                const hotel = slot.hotel;

                if (!hotel) {
                  return null;
                }

                const brandColor = BRAND_BY_NAME[hotel.brand]?.color ?? '#1D4ED8';

                return (
                  <article
                    key={`${slot.rank}-${hotel.id}-${slot.description}`}
                    className="relative overflow-hidden rounded-[28px] border border-white/50 bg-[rgba(255,255,255,0.82)] shadow-[0_20px_60px_rgba(26,74,122,0.16)]"
                  >
                    <div className="relative h-52 sm:h-56">
                      {slot.imageUrl ? (
                        <UserPhoto
                          src={slot.imageUrl}
                          alt={hotel.name}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{
                            background: `radial-gradient(circle at top left, ${brandColor}66, transparent 34%), linear-gradient(135deg, ${brandColor}26, rgba(18,42,68,0.18))`
                          }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,18,32,0.94)] via-[rgba(12,24,40,0.36)] to-transparent" />
                      <div className="absolute left-4 top-4 rounded-full border border-white/70 bg-[rgba(255,255,255,0.78)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--wine))] shadow-[0_10px_24px_rgba(12,24,40,0.18)] backdrop-blur-md">
                        No. {slot.rank}
                      </div>
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="text-xl font-semibold leading-tight text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)]">
                          {hotel.name}
                        </div>
                        <div className="mt-2 rounded-[18px] border border-white/18 bg-white/14 px-3 py-2 text-sm leading-relaxed text-white backdrop-blur-sm">
                          {slot.description}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/58 p-5 text-sm text-[rgba(34,58,86,0.62)]">
              Click Top 3 Experiences to set up your most memorable stays.
            </div>
          )}
        </section>
        ) : null}

        {displayPreferences.showTopUnderrated ? (
        <section className="glass-panel rounded-[28px] px-4 py-4 sm:px-5 sm:py-5" style={{ order: getSectionOrder('topUnderrated') }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <button
                type="button"
                onClick={openTopUnderratedModal}
                className="section-label transition hover:text-[rgb(var(--wine))]"
              >
                Top 3 Underrated
              </button>
              <h2 className="mt-2 text-2xl font-semibold text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-3xl">
                Hidden Gems
              </h2>
            </div>
          </div>

          {hasCompleteTopUnderrated ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {topUnderratedResolved.map((slot) => {
                const hotel = slot.hotel;

                if (!hotel) {
                  return null;
                }

                const brandColor = BRAND_BY_NAME[hotel.brand]?.color ?? '#1D4ED8';

                return (
                  <article
                    key={`${slot.rank}-${hotel.id}`}
                    className="relative overflow-hidden rounded-[28px] border border-white/50 bg-[rgba(255,255,255,0.82)] shadow-[0_20px_60px_rgba(26,74,122,0.16)]"
                  >
                    <div className="relative h-48 sm:h-52">
                      {slot.imageUrl ? (
                        <UserPhoto
                          src={slot.imageUrl}
                          alt={hotel.name}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{
                            background: `radial-gradient(circle at top left, ${brandColor}66, transparent 34%), linear-gradient(135deg, ${brandColor}26, rgba(18,42,68,0.18))`
                          }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(12,24,40,0.84)] via-[rgba(12,24,40,0.24)] to-transparent" />
                      <div className="absolute left-4 top-4 rounded-full border border-white/70 bg-[rgba(255,255,255,0.78)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--wine))] shadow-[0_10px_24px_rgba(12,24,40,0.18)] backdrop-blur-md">
                        No. {slot.rank}
                      </div>
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="text-2xl font-semibold leading-tight text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.42)]">
                          {hotel.name}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/58 p-5 text-sm text-[rgba(34,58,86,0.62)]">
              Click Top 3 Underrated to set up your hidden gems.
            </div>
          )}
        </section>
        ) : null}

        {displayPreferences.showTopReturnStays ? (
        <section className="glass-panel rounded-[28px] px-4 py-4 sm:px-5 sm:py-5" style={{ order: getSectionOrder('topReturnStays') }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <button
                type="button"
                onClick={openTopReturnStaysModal}
                className="section-label transition hover:text-[rgb(var(--wine))]"
              >
                Top 3 Return Stays
              </button>
              <h2 className="mt-2 text-2xl font-semibold text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-3xl">
                Would Stay Again
              </h2>
            </div>
          </div>

          {hasCompleteTopReturnStays ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {topReturnStaysResolved.map((slot) => {
                const hotel = slot.hotel;

                if (!hotel) {
                  return null;
                }

                const brandColor = BRAND_BY_NAME[hotel.brand]?.color ?? '#1D4ED8';

                return (
                  <article
                    key={`${slot.rank}-${hotel.id}`}
                    className="relative overflow-hidden rounded-[28px] border border-white/50 bg-[rgba(255,255,255,0.82)] shadow-[0_20px_60px_rgba(26,74,122,0.16)]"
                  >
                    <div className="relative h-48 sm:h-52">
                      {slot.imageUrl ? (
                        <UserPhoto
                          src={slot.imageUrl}
                          alt={hotel.name}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{
                            background: `radial-gradient(circle at top left, ${brandColor}66, transparent 34%), linear-gradient(135deg, ${brandColor}26, rgba(18,42,68,0.18))`
                          }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(12,24,40,0.84)] via-[rgba(12,24,40,0.24)] to-transparent" />
                      <div className="absolute left-4 top-4 rounded-full border border-white/70 bg-[rgba(255,255,255,0.78)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--wine))] shadow-[0_10px_24px_rgba(12,24,40,0.18)] backdrop-blur-md">
                        No. {slot.rank}
                      </div>
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="text-2xl font-semibold leading-tight text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.42)]">
                          {hotel.name}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/58 p-5 text-sm text-[rgba(34,58,86,0.62)]">
              Click Top 3 Return Stays to set up the hotels you would stay at again.
            </div>
          )}
        </section>
        ) : null}
      </div>

      <DashboardMenuModal
        isOpen={isMenuOpen}
        sections={menuSections}
        sectionOrder={displayPreferences.sectionOrder}
        onClose={() => setIsMenuOpen(false)}
        onReset={() => void resetDashboardLayout()}
        onReorder={(draggedId, targetId) => void reorderSections(draggedId, targetId)}
      />

      {isTopOverviewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel max-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-hidden rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Top 3 Overview</p>
                <h2 className="mt-2 text-2xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                  My Personal Podiums
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsTopOverviewOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close all top 3 overview"
              >
                ×
              </button>
            </div>

            <div className="mt-6 max-h-[70vh] overflow-auto pr-1">
              <div className="grid gap-4 xl:grid-cols-2">
                {topOverviewSections.map((section) => (
                  <section
                    key={section.id}
                    className="rounded-[24px] border border-[rgba(0,102,179,0.12)] bg-white/68 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="section-label">{section.label}</p>
                        <h3 className="mt-2 text-xl font-semibold text-[rgb(var(--page-foreground))] font-[family:var(--font-display)]">
                          {section.title}
                        </h3>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {([1, 2, 3] as TopPickRank[]).map((rank) => {
                        const item = section.items.find((entry) => entry.rank === rank);

                        if (!item) {
                          return (
                            <div
                              key={`${section.id}-${rank}`}
                              className="flex min-h-[214px] flex-col justify-between rounded-[20px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/52 p-3"
                            >
                              <div className="inline-flex w-fit rounded-full border border-[rgba(118,31,47,0.16)] bg-white/82 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgb(var(--wine))]">
                                No. {rank}
                              </div>
                              <div className="text-sm leading-relaxed text-[rgba(34,58,86,0.58)]">
                                {section.emptyMessage}
                              </div>
                            </div>
                          );
                        }

                        const brandColor = BRAND_BY_NAME[item.hotel.brand]?.color ?? '#1D4ED8';
                        return (
                          <article
                            key={`${section.id}-${item.rank}-${item.hotel.id}`}
                            className="flex h-full min-h-[176px] flex-col overflow-hidden rounded-[20px] border border-white/50 bg-[rgba(255,255,255,0.84)] shadow-[0_16px_36px_rgba(26,74,122,0.12)]"
                          >
                            <div className="relative h-28">
                              {item.imageUrl ? (
                                <UserPhoto
                                  src={item.imageUrl}
                                  alt={item.hotel.name}
                                  className="absolute inset-0 h-full w-full object-cover"
                                />
                              ) : (
                                <div
                                  className="h-full w-full"
                                  style={{
                                    background: `radial-gradient(circle at top left, ${brandColor}66, transparent 34%), linear-gradient(135deg, ${brandColor}26, rgba(18,42,68,0.18))`
                                  }}
                                />
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,18,32,0.88)] via-[rgba(12,24,40,0.2)] to-transparent" />
                              {section.id === 'top-suites' && item.imageLabel ? (
                                <div className="absolute left-3 top-3 max-w-[88%] rounded-[12px] border border-white/40 bg-[rgba(255,255,255,0.74)] px-3 py-1.5 text-[0.62rem] font-semibold leading-none text-[rgb(var(--wine))] shadow-[0_10px_24px_rgba(12,24,40,0.14)] backdrop-blur-sm sm:text-[0.68rem]">
                                  <div className="truncate">{item.imageLabel}</div>
                                </div>
                              ) : (
                                <div className="absolute left-3 top-3 rounded-full border border-white/70 bg-[rgba(255,255,255,0.78)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgb(var(--wine))] shadow-[0_10px_24px_rgba(12,24,40,0.18)] backdrop-blur-md">
                                  No. {item.rank}
                                </div>
                              )}
                            </div>

                            <div className="p-3">
                              <div className="min-h-[2.7rem] text-sm font-semibold leading-[1.35] text-[rgb(var(--page-foreground))]">
                                <div className="line-clamp-2">{item.title}</div>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedBrand && selectedBrandHotels.length ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-3xl rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Hyatt Brands</p>
                <h2 className="mt-2 text-3xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                  {selectedBrand.name}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedBrandName(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close brand hotels"
              >
                ×
              </button>
            </div>

            <div className="mt-6 max-h-[70vh] space-y-5 overflow-auto pr-1">
              {(['EXPLORED', 'FUTURE', 'BUCKET_LIST'] as const).map((stayType) => {
                const brandHotels = selectedBrandHotels.filter((hotel) => hotel.stayType === stayType);

                if (!brandHotels.length) {
                  return null;
                }

                return (
                  <section key={stayType} className="rounded-[24px] border border-[rgba(0,102,179,0.12)] bg-white/68 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[rgba(34,58,86,0.58)]">
                        {stayType === 'EXPLORED'
                          ? 'Explored'
                          : stayType === 'FUTURE'
                            ? 'Planned'
                            : 'Bucket List'}
                      </div>
                      <div className="rounded-full border border-white/80 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(34,58,86,0.58)]">
                        {brandHotels.length}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {brandHotels.map((hotel) => (
                        <div
                          key={hotel.id}
                          className="rounded-[20px] border p-4"
                          style={{
                            borderColor: `${selectedBrand.color}22`,
                            backgroundColor: `${selectedBrand.color}0D`
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-base font-semibold text-[rgb(var(--page-foreground))]">
                                {hotel.name}
                              </div>
                              <div className="mt-1 text-xs uppercase tracking-[0.14em] text-[rgba(34,58,86,0.52)]">
                                {stayType === 'EXPLORED'
                                  ? `${hotel.tier ?? 'Unranked'}${hotel.tier ? '-Tier' : ''}`
                                  : stayType === 'FUTURE'
                                    ? formatMonthYear(getPrimaryFutureStayEntry(hotel))
                                    : hotel.bucketListLocation || 'Bucket List'}
                              </div>
                              {hotel.roomEntries.length ? (
                                <div className="mt-2 text-sm text-[rgba(34,58,86,0.68)]">
                                  {formatRoomEntries(hotel.roomEntries)}
                                </div>
                              ) : null}
                            </div>

                            <div className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-[rgba(34,58,86,0.12)] bg-white/75 px-2 text-xs font-semibold text-[rgba(34,58,86,0.72)]">
                              {hotel.roomEntries.length}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {isSuitePickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel max-h-[calc(100vh-3rem)] w-full max-w-5xl overflow-hidden rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">My Suite Explorations</p>
              </div>

              <button
                type="button"
                onClick={() => setIsSuitePickerOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close suite picker"
              >
                ×
              </button>
            </div>

            <div className="mt-6 max-h-[70vh] overflow-auto pr-1">
              {loggedSuiteSlides.length ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {loggedSuiteSlides.map((suite) => {
                    const brandColor = BRAND_BY_NAME[suite.hotel.brand]?.color ?? '#1D4ED8';

                    return (
                      <button
                        key={suite.id}
                        type="button"
                        onClick={() => {
                          setIsSuitePickerOpen(false);
                          openEditModal(suite.hotel);
                        }}
                        className="group overflow-hidden rounded-[26px] border border-white/50 bg-[rgba(255,255,255,0.82)] text-left shadow-[0_20px_60px_rgba(26,74,122,0.16)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_64px_rgba(26,74,122,0.2)]"
                      >
                        <div className="relative h-52 sm:h-56">
                          {suite.imageUrl ? (
                            <UserPhoto
                              src={suite.imageUrl}
                              alt={`${suite.hotel.name} ${suite.suiteName}`}
                              className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div
                              className="h-full w-full"
                              style={{
                                background: `radial-gradient(circle at top left, ${brandColor}66, transparent 34%), linear-gradient(135deg, ${brandColor}26, rgba(18,42,68,0.18))`
                              }}
                            />
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,18,32,0.92)] via-[rgba(12,24,40,0.28)] to-transparent" />

                          <div className="absolute left-4 top-4 rounded-full border border-white/20 bg-[rgba(255,255,255,0.14)] px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-md">
                            {suite.hotel.brand}
                          </div>

                          <div className="absolute right-4 top-4 rounded-full border border-white/20 bg-[rgba(255,255,255,0.14)] px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-md">
                            {suite.stars ? `${suite.stars}/5` : 'Unrated'}
                          </div>

                          <div className="absolute bottom-4 left-4 right-4">
                            <div className="text-xl font-semibold leading-tight text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)] sm:text-2xl">
                              {suite.suiteName}
                            </div>
                            <div className="mt-2 text-sm font-medium uppercase tracking-[0.14em] text-white/90 drop-shadow-[0_3px_8px_rgba(0,0,0,0.45)]">
                              {suite.hotel.name}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/58 p-5 text-sm text-[rgba(34,58,86,0.62)]">
                  Add suite entries with image URLs to explored hotels and they will appear here.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isKellyHotelsPickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel max-h-[calc(100vh-3rem)] w-full max-w-5xl overflow-hidden rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">My Hyatt Exploration with Kelly ❤️❤️</p>
              </div>

              <button
                type="button"
                onClick={() => setIsKellyHotelsPickerOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close Kelly hotels picker"
              >
                ×
              </button>
            </div>

            <div className="mt-6 max-h-[70vh] overflow-auto pr-1">
              {kellyExplorationHotels.length ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {kellyExplorationHotels.map((hotel) => {
                    const kellyStayEntries = hotel.stayEntries.filter((entry) => entry.withKelly);
                    const brandColor = BRAND_BY_NAME[hotel.brand]?.color ?? '#1D4ED8';

                    return (
                      <button
                        key={hotel.id}
                        type="button"
                        onClick={() => {
                          setIsKellyHotelsPickerOpen(false);
                          openEditModal(hotel);
                        }}
                        className="rounded-[24px] border border-white/50 bg-[rgba(255,255,255,0.82)] p-4 text-left shadow-[0_18px_40px_rgba(26,74,122,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_48px_rgba(26,74,122,0.16)]"
                      >
                        <div>
                          <div
                            className="inline-block max-w-full rounded-[18px] px-3 py-1.5 text-[0.64rem] font-semibold uppercase leading-[1rem] tracking-[0.08em]"
                            style={{ backgroundColor: `${brandColor}1A`, color: brandColor }}
                          >
                            {hotel.brand}
                          </div>
                          <div className="mt-3 text-lg font-semibold text-[rgb(var(--page-foreground))]">
                            {hotel.name}
                          </div>
                        </div>

                        {kellyStayEntries.length ? (
                          <div className="mt-3 text-sm text-[rgba(34,58,86,0.68)]">
                            {kellyStayEntries.map((entry) => formatMonthYear(entry)).join(' • ')}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/58 p-5 text-sm text-[rgba(34,58,86,0.62)]">
                  Open any explored hotel and mark individual stays or suites with Kelly ❤️ to start building this section.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isBucketListPickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel max-h-[calc(100vh-3rem)] w-full max-w-5xl overflow-hidden rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">My Hyatt Bucket List</p>
              </div>

              <button
                type="button"
                onClick={() => setIsBucketListPickerOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close bucket list picker"
              >
                ×
              </button>
            </div>

            {bucketListBrandOptions.length ? (
              <div className="mt-5 max-w-xs">
                <FancySelect
                  value={selectedBucketListBrandName}
                  onChange={setSelectedBucketListBrandName}
                  options={[
                    { value: ALL_BUCKET_LIST_BRANDS, label: 'All brands' },
                    ...bucketListBrandOptions
                  ]}
                  placeholder="Filter by brand"
                  buttonClassName="bg-white/78"
                />
              </div>
            ) : null}

            <div className="mt-6 max-h-[70vh] overflow-auto pr-1">
              {bucketListHotels.length ? (
                filteredBucketListHotels.length ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredBucketListHotels.map((hotel) => {
                    const brandColor = BRAND_BY_NAME[hotel.brand]?.color ?? '#1D4ED8';

                    return (
                      <button
                        key={hotel.id}
                        type="button"
                        onClick={() => {
                          setIsBucketListPickerOpen(false);
                          openEditModal(hotel);
                        }}
                        className="group overflow-hidden rounded-[26px] border border-white/50 bg-[rgba(255,255,255,0.82)] text-left shadow-[0_20px_60px_rgba(26,74,122,0.16)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_64px_rgba(26,74,122,0.2)]"
                      >
                        <div className="relative h-52 sm:h-56">
                          {hotel.bucketListImageUrl ? (
                            <UserPhoto
                              src={hotel.bucketListImageUrl}
                              alt={`${hotel.name} in ${hotel.bucketListLocation}`}
                              className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div
                              className="h-full w-full"
                              style={{
                                background: `radial-gradient(circle at top left, ${brandColor}66, transparent 34%), linear-gradient(135deg, ${brandColor}26, rgba(18,42,68,0.18))`
                              }}
                            />
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,18,32,0.92)] via-[rgba(12,24,40,0.28)] to-transparent" />

                          <div className="absolute left-4 top-4 rounded-full border border-white/20 bg-[rgba(255,255,255,0.14)] px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-md">
                            {hotel.brand}
                          </div>

                          <div className="absolute bottom-4 left-4 right-4">
                            <div className="text-xl font-semibold leading-tight text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)] sm:text-2xl">
                              {hotel.name}
                            </div>
                            <div className="mt-2 text-sm font-medium uppercase tracking-[0.14em] text-white/90 drop-shadow-[0_3px_8px_rgba(0,0,0,0.45)]">
                              {hotel.bucketListLocation || 'Location needed'}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                ) : (
                  <div className="rounded-[22px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/58 p-5 text-sm text-[rgba(34,58,86,0.62)]">
                    No bucket-list hotels match this brand yet.
                  </div>
                )
              ) : (
                <div className="rounded-[22px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/58 p-5 text-sm text-[rgba(34,58,86,0.62)]">
                  Add a bucket-list hotel first, then click My Hyatt Bucket List to edit it from here.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isKellyBrandsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-4xl rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Brands Explored Together</p>
                <h2 className="mt-2 text-2xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                  Hyatt brands with Kelly ❤️❤️
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsKellyBrandsOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close Kelly brands"
              >
                ×
              </button>
            </div>

            <div className="mt-6 max-h-[70vh] overflow-auto pr-1">
              {BRANDS_BY_SEGMENT.length ? (
                <div className="space-y-5">
                  {BRANDS_BY_SEGMENT.map(({ segment, brands }) => (
                    <div key={segment} className="rounded-[24px] border border-[rgba(118,31,47,0.1)] bg-white/60 p-4">
                      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(64,35,37,0.48)]">
                        {segment}
                      </div>
                      <div className="flex flex-wrap gap-2.5">
                        {brands.map((brand) => {
                          const isKellyExplored = kellyExploredBrandNames.has(brand.name);
                          const brandStyle = getBrandVisualStyle(brand.name, brand.color);

                          return (
                            <button
                              key={brand.name}
                              type="button"
                              onClick={() => {
                                if (isKellyExplored) {
                                  setIsKellyBrandsOpen(false);
                                  setSelectedBrandName(brand.name);
                                }
                              }}
                              disabled={!isKellyExplored}
                              className="rounded-2xl border px-3 py-2 text-center text-[0.7rem] font-semibold uppercase leading-[1rem] tracking-[0.08em] shadow-[0_10px_22px_rgba(81,39,43,0.08)] transition hover:-translate-y-0.5 disabled:cursor-default disabled:shadow-none"
                              style={{
                                borderColor: isKellyExplored ? brandStyle.borderColor : 'rgba(148,163,184,0.22)',
                                background: isKellyExplored ? brandStyle.background : 'rgba(148,163,184,0.12)',
                                color: isKellyExplored ? brandStyle.labelColor : '#94A3B8',
                                boxShadow: isKellyExplored ? `0 10px 22px ${brandStyle.shadowColor}` : 'none'
                              }}
                            >
                              {brand.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/58 p-5 text-sm text-[rgba(34,58,86,0.62)]">
                  Mark a stay or suite with Kelly ❤️ to start building this brand palette.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isAllBrandsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-4xl rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Brand Palette</p>
                <h2 className="mt-2 text-2xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                  Hyatt brands and colors
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsAllBrandsOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close all brands"
              >
                ×
              </button>
            </div>

            <div className="mt-6 max-h-[70vh] overflow-auto pr-1">
              <div className="space-y-5">
                {BRANDS_BY_SEGMENT.map(({ segment, brands }) => (
                  <div key={segment} className="rounded-[24px] border border-[rgba(118,31,47,0.1)] bg-white/60 p-4">
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(64,35,37,0.48)]">
                      {segment}
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {brands.map((brand) => (
                        (() => {
                          const brandStyle = getBrandVisualStyle(brand.name, brand.color);

                          return (
                        <div
                          key={brand.name}
                          className="rounded-full border px-3 py-2 text-xs font-semibold shadow-[0_10px_22px_rgba(81,39,43,0.08)]"
                          style={{
                            borderColor: brandStyle.borderColor,
                            background: brandStyle.background,
                            color: brandStyle.labelColor,
                            boxShadow: `0 10px 22px ${brandStyle.shadowColor}`
                          }}
                        >
                          {brand.name}
                        </div>
                        );})()
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isExploredBrandsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-4xl rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Brands Explored</p>
                <h2 className="mt-2 text-2xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                  All Hyatt brands
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsExploredBrandsOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close explored brands"
              >
                ×
              </button>
            </div>

            <div className="mt-6 max-h-[70vh] overflow-auto pr-1">
              <div className="space-y-5">
                {BRANDS_BY_SEGMENT.map(({ segment, brands }) => (
                  <div key={segment} className="rounded-[24px] border border-[rgba(118,31,47,0.1)] bg-white/60 p-4">
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(64,35,37,0.48)]">
                      {segment}
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {brands.map((brand) => {
                        const isExplored = exploredBrandNames.has(brand.name);
                        const brandStyle = getBrandVisualStyle(brand.name, brand.color);

                        return (
                        <button
                          key={brand.name}
                          type="button"
                          onClick={() => {
                            if (isExplored) {
                              setIsExploredBrandsOpen(false);
                              setSelectedBrandName(brand.name);
                            }
                          }}
                          disabled={!isExplored}
                          className="rounded-full border px-3 py-2 text-xs font-semibold shadow-[0_10px_22px_rgba(81,39,43,0.08)] transition disabled:cursor-default disabled:shadow-none"
                          style={{
                            borderColor: isExplored ? brandStyle.borderColor : 'rgba(148,163,184,0.22)',
                            background: isExplored ? brandStyle.background : 'rgba(148,163,184,0.12)',
                            color: isExplored ? brandStyle.labelColor : '#94A3B8',
                            boxShadow: isExplored ? `0 10px 22px ${brandStyle.shadowColor}` : 'none'
                          }}
                        >
                          {brand.name}
                        </button>
                      );})}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isFutureBrandsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-3xl rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Planned Brand Explorations</p>
                <h2 className="mt-2 text-2xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                  Future Hyatt Brands on Deck
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsFutureBrandsOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close planned brand explorations"
              >
                ×
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {futureExploringBrands.map((brand) => {
                const style = getBrandVisualStyle(brand.name, brand.color);

                return (
                  <div
                    key={brand.name}
                    className="rounded-[22px] border p-4"
                    style={{
                      borderColor: style.borderColor,
                      background: style.background
                    }}
                  >
                    <div className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: style.labelColor }}>
                      {brand.segment}
                    </div>
                    <div className="mt-2 text-xl font-semibold text-[rgb(var(--page-foreground))]">
                      {brand.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {isTopPicksOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel max-h-[calc(100vh-3rem)] w-full max-w-3xl overflow-y-auto rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Top 3 Hotels</p>
                <h2 className="mt-2 text-2xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                  Build your podium
                </h2>
                <div className="mt-2 text-sm text-[rgba(34,58,86,0.62)]">
                  Pick your three best explored hotels. You can also paste a photo URL if you want image cards.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTopPicksOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close top 3 hotels"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {topPicksDraft.map((slot, index) => (
                <div key={slot.rank} className="rounded-[24px] border border-[rgba(0,102,179,0.1)] bg-white/68 p-4">
                  <div className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-[rgba(34,58,86,0.58)]">
                    Rank #{slot.rank}
                  </div>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Hotel</span>
                      <select
                        value={slot.hotelId}
                        onChange={(event) =>
                          setTopPicksDraft((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, hotelId: event.target.value } : item
                            )
                          )
                        }
                        className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/90 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                      >
                        <option value="">Select a hotel</option>
                        {exploredHotels.map((hotel) => (
                          <option key={hotel.id} value={hotel.id}>
                            {hotel.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Photo URL</span>
                      <input
                        value={slot.imageUrl}
                        onChange={(event) =>
                          setTopPicksDraft((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, imageUrl: event.target.value } : item
                            )
                          )
                        }
                        placeholder="Paste an image URL"
                        className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/90 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {topPicksError ? (
              <div className="mt-4 rounded-[18px] border border-[rgba(118,31,47,0.18)] bg-[rgba(118,31,47,0.06)] px-4 py-3 text-sm text-[rgb(var(--wine))]">
                {topPicksError}
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsTopPicksOpen(false)}
                className="rounded-full border border-[rgba(118,31,47,0.16)] bg-white/82 px-5 py-2.5 text-sm font-semibold text-[rgb(var(--page-foreground))] transition hover:bg-[rgba(118,31,47,0.06)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTopPicks}
                className="rounded-full bg-[rgb(var(--wine))] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#004f8d]"
              >
                Save top 3
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isTopSuitesOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel max-h-[calc(100vh-3rem)] w-full max-w-4xl overflow-y-auto rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Top 3 Suites</p>
                <h2 className="mt-2 text-2xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                  Build your favorites
                </h2>
                <div className="mt-2 text-sm text-[rgba(34,58,86,0.62)]">
                  Pick your three favorite suites, add the suite name, and optionally paste a photo URL.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTopSuitesOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close top 3 suites"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {topSuitesDraft.map((slot, index) => {
                const suiteOptions = exploredHotelsWithSuites
                  .find((hotel) => hotel.id === slot.hotelId)
                  ?.roomEntries.filter((entry) => entry.kind === 'SUITE')
                  .map((entry) => entry.label) ?? [];

                return (
                  <div key={slot.rank} className="rounded-[24px] border border-[rgba(0,102,179,0.1)] bg-white/68 p-4">
                    <div className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-[rgba(34,58,86,0.58)]">
                      Rank #{slot.rank}
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Hotel</span>
                        <select
                          value={slot.hotelId}
                          onChange={(event) =>
                            setTopSuitesDraft((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, hotelId: event.target.value, suiteName: '' } : item
                              )
                            )
                          }
                          className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/90 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                        >
                          <option value="">Select a hotel</option>
                          {exploredHotelsWithSuites.map((hotel) => (
                            <option key={hotel.id} value={hotel.id}>
                              {hotel.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Suite</span>
                        <>
                          <input
                            value={slot.suiteName}
                            onChange={(event) =>
                              setTopSuitesDraft((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, suiteName: event.target.value } : item
                                )
                              )
                            }
                            list={`suite-options-${slot.rank}`}
                            placeholder="Type the suite name"
                            className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/90 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                          />
                          <datalist id={`suite-options-${slot.rank}`}>
                            {suiteOptions.map((suiteName) => (
                              <option key={suiteName} value={suiteName} />
                            ))}
                          </datalist>
                        </>
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Photo URL</span>
                        <input
                          value={slot.imageUrl}
                          onChange={(event) =>
                            setTopSuitesDraft((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, imageUrl: event.target.value } : item
                              )
                            )
                          }
                          placeholder="Paste an image URL"
                          className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/90 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            {topSuitesError ? (
              <div className="mt-4 rounded-[18px] border border-[rgba(118,31,47,0.18)] bg-[rgba(118,31,47,0.06)] px-4 py-3 text-sm text-[rgb(var(--wine))]">
                {topSuitesError}
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsTopSuitesOpen(false)}
                className="rounded-full border border-[rgba(118,31,47,0.16)] bg-white/82 px-5 py-2.5 text-sm font-semibold text-[rgb(var(--page-foreground))] transition hover:bg-[rgba(118,31,47,0.06)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTopSuites}
                className="rounded-full bg-[rgb(var(--wine))] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#004f8d]"
              >
                Save top 3 suites
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isTopFutureStaysOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel max-h-[calc(100vh-3rem)] w-full max-w-4xl overflow-y-auto rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Top 3 Future Stays</p>
                <h2 className="mt-2 text-2xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                  Build your most anticipated list
                </h2>
                <div className="mt-2 text-sm text-[rgba(34,58,86,0.62)]">
                  Pick your three most anticipated future hotels, add the location, and optionally paste a photo URL.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTopFutureStaysOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close top 3 future stays"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {topFutureStaysDraft.map((slot, index) => (
                <div key={slot.rank} className="rounded-[24px] border border-[rgba(0,102,179,0.1)] bg-white/68 p-4">
                  <div className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-[rgba(34,58,86,0.58)]">
                    Rank #{slot.rank}
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Hotel</span>
                      <select
                        value={slot.hotelId}
                        onChange={(event) =>
                          setTopFutureStaysDraft((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, hotelId: event.target.value } : item
                            )
                          )
                        }
                        className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/90 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                      >
                        <option value="">Select a hotel</option>
                        {futureHotels.map((hotel) => (
                          <option key={hotel.id} value={hotel.id}>
                            {hotel.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Location</span>
                      <input
                        value={slot.location}
                        onChange={(event) =>
                          setTopFutureStaysDraft((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, location: event.target.value } : item
                            )
                          )
                        }
                        placeholder="City, state, or destination"
                        className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/90 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Photo URL</span>
                      <input
                        value={slot.imageUrl}
                        onChange={(event) =>
                          setTopFutureStaysDraft((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, imageUrl: event.target.value } : item
                            )
                          )
                        }
                        placeholder="Paste an image URL"
                        className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/90 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {topFutureStaysError ? (
              <div className="mt-4 rounded-[18px] border border-[rgba(118,31,47,0.18)] bg-[rgba(118,31,47,0.06)] px-4 py-3 text-sm text-[rgb(var(--wine))]">
                {topFutureStaysError}
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsTopFutureStaysOpen(false)}
                className="rounded-full border border-[rgba(118,31,47,0.16)] bg-white/82 px-5 py-2.5 text-sm font-semibold text-[rgb(var(--page-foreground))] transition hover:bg-[rgba(118,31,47,0.06)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTopFutureStays}
                className="rounded-full bg-[rgb(var(--wine))] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#004f8d]"
              >
                Save top 3 future stays
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isTopExperiencesOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel max-h-[calc(100vh-3rem)] w-full max-w-3xl overflow-y-auto rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Top 3 Experiences</p>
                <h2 className="mt-2 text-2xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                  Build your most memorable list
                </h2>
                <div className="mt-2 text-sm text-[rgba(34,58,86,0.62)]">
                  Pick the stays that stand out most, add a short description, and optionally paste a photo URL.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTopExperiencesOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close top 3 experiences"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {topExperiencesDraft.map((slot, index) => (
                <div key={slot.rank} className="rounded-[24px] border border-[rgba(0,102,179,0.1)] bg-white/68 p-4">
                  <div className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-[rgba(34,58,86,0.58)]">
                    Rank #{slot.rank}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Hotel</span>
                      <select
                        value={slot.hotelId}
                        onChange={(event) =>
                          setTopExperiencesDraft((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, hotelId: event.target.value } : item
                            )
                          )
                        }
                        className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/90 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                      >
                        <option value="">Select a hotel</option>
                        {exploredHotels.map((hotel) => (
                          <option key={hotel.id} value={hotel.id}>
                            {hotel.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Photo URL</span>
                      <input
                        value={slot.imageUrl}
                        onChange={(event) =>
                          setTopExperiencesDraft((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, imageUrl: event.target.value } : item
                            )
                          )
                        }
                        placeholder="Paste an image URL"
                        className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/90 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                      />
                    </label>

                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Description</span>
                      <input
                        value={slot.description}
                        onChange={(event) =>
                          setTopExperiencesDraft((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, description: event.target.value } : item
                            )
                          )
                        }
                        placeholder="Short one-line highlight"
                        maxLength={120}
                        className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/90 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {topExperiencesError ? (
              <div className="mt-4 rounded-[18px] border border-[rgba(118,31,47,0.18)] bg-[rgba(118,31,47,0.06)] px-4 py-3 text-sm text-[rgb(var(--wine))]">
                {topExperiencesError}
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsTopExperiencesOpen(false)}
                className="rounded-full border border-[rgba(118,31,47,0.16)] bg-white/82 px-5 py-2.5 text-sm font-semibold text-[rgb(var(--page-foreground))] transition hover:bg-[rgba(118,31,47,0.06)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTopExperiences}
                className="rounded-full bg-[rgb(var(--wine))] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#004f8d]"
              >
                Save top 3 experiences
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isTopUnderratedOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel max-h-[calc(100vh-3rem)] w-full max-w-4xl overflow-y-auto rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Top 3 Underrated</p>
                <h2 className="mt-2 text-2xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                  Build your hidden gems list
                </h2>
                <div className="mt-2 text-sm text-[rgba(34,58,86,0.62)]">
                  Pick three hotels you think deserve more love and optionally paste a photo URL.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTopUnderratedOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close top 3 underrated"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {topUnderratedDraft.map((slot, index) => (
                <div key={slot.rank} className="rounded-[24px] border border-[rgba(0,102,179,0.1)] bg-white/68 p-4">
                  <div className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-[rgba(34,58,86,0.58)]">
                    Rank #{slot.rank}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Hotel</span>
                      <select
                        value={slot.hotelId}
                        onChange={(event) =>
                          setTopUnderratedDraft((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, hotelId: event.target.value } : item
                            )
                          )
                        }
                        className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/90 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                      >
                        <option value="">Select a hotel</option>
                        {exploredHotels.map((hotel) => (
                          <option key={hotel.id} value={hotel.id}>
                            {hotel.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Photo URL</span>
                      <input
                        value={slot.imageUrl}
                        onChange={(event) =>
                          setTopUnderratedDraft((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, imageUrl: event.target.value } : item
                            )
                          )
                        }
                        placeholder="Paste an image URL"
                        className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/90 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {topUnderratedError ? (
              <div className="mt-4 rounded-[18px] border border-[rgba(118,31,47,0.18)] bg-[rgba(118,31,47,0.06)] px-4 py-3 text-sm text-[rgb(var(--wine))]">
                {topUnderratedError}
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsTopUnderratedOpen(false)}
                className="rounded-full border border-[rgba(118,31,47,0.16)] bg-white/82 px-5 py-2.5 text-sm font-semibold text-[rgb(var(--page-foreground))] transition hover:bg-[rgba(118,31,47,0.06)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTopUnderrated}
                className="rounded-full bg-[rgb(var(--wine))] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#004f8d]"
              >
                Save top 3 underrated
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isTopReturnStaysOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel max-h-[calc(100vh-3rem)] w-full max-w-4xl overflow-y-auto rounded-[30px] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Top 3 Return Stays</p>
                <h2 className="mt-2 text-2xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                  Build your would-stay-again list
                </h2>
                <div className="mt-2 text-sm text-[rgba(34,58,86,0.62)]">
                  Pick the three hotels you would gladly return to and optionally paste a photo URL.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTopReturnStaysOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close top 3 return stays"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {topReturnStaysDraft.map((slot, index) => (
                <div key={slot.rank} className="rounded-[24px] border border-[rgba(0,102,179,0.1)] bg-white/68 p-4">
                  <div className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-[rgba(34,58,86,0.58)]">
                    Rank #{slot.rank}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Hotel</span>
                      <select
                        value={slot.hotelId}
                        onChange={(event) =>
                          setTopReturnStaysDraft((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, hotelId: event.target.value } : item
                            )
                          )
                        }
                        className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/90 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                      >
                        <option value="">Select a hotel</option>
                        {exploredHotels.map((hotel) => (
                          <option key={hotel.id} value={hotel.id}>
                            {hotel.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Photo URL</span>
                      <input
                        value={slot.imageUrl}
                        onChange={(event) =>
                          setTopReturnStaysDraft((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, imageUrl: event.target.value } : item
                            )
                          )
                        }
                        placeholder="Paste an image URL"
                        className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/90 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {topReturnStaysError ? (
              <div className="mt-4 rounded-[18px] border border-[rgba(118,31,47,0.18)] bg-[rgba(118,31,47,0.06)] px-4 py-3 text-sm text-[rgb(var(--wine))]">
                {topReturnStaysError}
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsTopReturnStaysOpen(false)}
                className="rounded-full border border-[rgba(118,31,47,0.16)] bg-white/82 px-5 py-2.5 text-sm font-semibold text-[rgb(var(--page-foreground))] transition hover:bg-[rgba(118,31,47,0.06)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTopReturnStays}
                className="rounded-full bg-[rgb(var(--wine))] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#004f8d]"
              >
                Save top 3 return stays
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,18,22,0.48)] px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-8">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={modalState.mode === 'edit' ? 'Edit hotel stay' : 'Add hotel stay'}
            className="glass-panel max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[30px] p-5 sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">{modalState.mode === 'edit' ? 'Edit Hotel' : 'Add Hotel'}</p>
                {modalState.mode === 'edit' ? (
                  <h2 className="mt-2 text-3xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)] sm:text-4xl">
                    Update this stay
                  </h2>
                ) : null}
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(118,31,47,0.16)] bg-white/80 text-lg text-[rgb(var(--wine))] transition hover:bg-[rgba(118,31,47,0.06)]"
                aria-label="Close hotel editor"
              >
                ×
              </button>
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-2 md:col-span-2">
                  <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Hotel name</span>
                  <input
                    value={draft.name}
                    onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-[18px] border border-[rgba(118,31,47,0.14)] bg-white/88 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Brand</span>
                  <FancySelect
                    value={draft.brand}
                    onChange={(value) => setDraft((current) => ({ ...current, brand: value }))}
                    groups={BRANDS_BY_SEGMENT.map(({ segment, brands }) => ({
                      label: segment,
                      options: brands.map((brand) => ({
                        value: brand.name,
                        label: brand.name,
                        color: brand.color
                      }))
                    }))}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Stay type</span>
                  <FancySelect
                    value={draft.stayType}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        stayType: value as StayType,
                        tier: value === 'EXPLORED' ? current.tier ?? 'S' : null,
                        stayEntries:
                          value === 'BUCKET_LIST'
                            ? []
                            : value === 'FUTURE'
                            ? current.stayEntries.length > 0
                              ? current.stayEntries
                              : [{ ...EMPTY_STAY_ENTRY, id: crypto.randomUUID() }]
                            : current.stayEntries
                      }))
                    }
                    options={STAY_TYPE_OPTIONS}
                  />
                </label>

                {draft.stayType === 'EXPLORED' ? (
                  <label className="block space-y-2 md:col-span-2 lg:col-span-1">
                    <span className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Tier</span>
                    <FancySelect
                      value={draft.tier ?? 'S'}
                      onChange={(value) => setDraft((current) => ({ ...current, tier: value as Tier }))}
                      options={TIERS.map((tier) => ({
                        value: tier,
                        label: `${tier}-Tier`
                      }))}
                    />
                  </label>
                ) : null}

                {draft.stayType === 'BUCKET_LIST' ? (
                  <div className="space-y-3 md:col-span-2">
                    <div>
                      <div className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Bucket List Details</div>
                      <div className="mt-1 text-xs text-[rgba(34,58,86,0.58)]">
                        Add the destination and a photo URL for the hotel card in your bucket-list slideshow.
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        value={draft.bucketListLocation}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, bucketListLocation: event.target.value }))
                        }
                        placeholder="Kyoto, Japan"
                        className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/92 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                      />

                      <input
                        value={draft.bucketListImageUrl}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, bucketListImageUrl: event.target.value }))
                        }
                        placeholder="https://example.com/hotel-photo.jpg"
                        className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/92 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                      />
                    </div>
                  </div>
                ) : null}

                {draft.stayType !== 'BUCKET_LIST' ? (
                <div className="space-y-3 md:col-span-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Room Type</div>
                      <div className="mt-1 text-xs text-[rgba(34,58,86,0.58)]">
                        {draft.stayType === 'EXPLORED'
                          ? 'Add each room or suite you stayed in for this hotel.'
                          : 'Add planned room or suite types for this hotel.'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={addRoomEntry}
                      className="inline-flex items-center justify-center rounded-full border border-[rgba(0,102,179,0.16)] bg-white/82 px-4 py-2 text-sm font-semibold text-[rgb(var(--wine))] transition hover:bg-[rgba(0,102,179,0.06)]"
                    >
                      Add room type
                    </button>
                  </div>

                  {draft.roomEntries.length ? (
                    <div className="space-y-3">
                      {draft.roomEntries.map((entry, index) => (
                        <div
                          key={`${index}-${entry.kind}`}
                          className="grid gap-3 rounded-[20px] border border-[rgba(0,102,179,0.1)] bg-white/72 p-3 md:grid-cols-[minmax(0,1fr)_10rem_auto]"
                        >
                          <input
                            value={entry.label}
                            onChange={(event) =>
                              updateRoomEntry(index, (current) => ({
                                ...current,
                                label: event.target.value
                              }))
                            }
                            placeholder="Standard"
                            className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/92 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                          />

                          <FancySelect
                            value={entry.kind}
                            onChange={(value) =>
                              updateRoomEntry(index, (current) => ({
                                ...current,
                                kind: value as RoomEntryKind
                              }))
                            }
                            options={ROOM_KIND_OPTIONS}
                          />

                          <button
                            type="button"
                            onClick={() => removeRoomEntry(index)}
                            className="inline-flex items-center justify-center rounded-full border border-[rgba(163,33,48,0.18)] bg-[rgba(163,33,48,0.08)] px-4 py-2 text-sm font-semibold text-[#a32130] transition hover:bg-[rgba(163,33,48,0.12)]"
                          >
                            Remove
                          </button>

                          {entry.kind === 'SUITE' ? (
                            <>
                              <input
                                value={entry.imageUrl}
                                onChange={(event) =>
                                  updateRoomEntry(index, (current) => ({
                                    ...current,
                                    imageUrl: event.target.value
                                  }))
                                }
                                placeholder="https://example.com/suite-photo.jpg"
                                className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/92 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)] md:col-span-2"
                              />

                              <div className="md:col-span-2 md:max-w-[12rem]">
                                <FancySelect
                                  value={entry.stars ? String(entry.stars) : 'unrated'}
                                  onChange={(value) =>
                                    updateRoomEntry(index, (current) => ({
                                      ...current,
                                      stars: value === 'unrated' ? null : (Number(value) as 1 | 2 | 3 | 4 | 5)
                                    }))
                                  }
                                  options={[
                                    { value: 'unrated', label: 'No rating yet' },
                                    { value: '1', label: '1 star' },
                                    { value: '2', label: '2 stars' },
                                    { value: '3', label: '3 stars' },
                                    { value: '4', label: '4 stars' },
                                    { value: '5', label: '5 stars' }
                                  ]}
                                />
                              </div>

                              <label className="md:col-span-2 flex items-center justify-between gap-4 rounded-[16px] border border-[rgba(0,102,179,0.1)] bg-white/72 px-4 py-3">
                                <div>
                                  <div className="text-sm font-semibold text-[rgb(var(--page-foreground))]">Stayed with Kelly ❤️❤️</div>
                                  <div className="mt-1 text-xs text-[rgba(34,58,86,0.58)]">
                                    Only turn this on for suites that were part of a Kelly trip.
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={entry.withKelly}
                                  onClick={() =>
                                    updateRoomEntry(index, (current) => ({
                                      ...current,
                                      withKelly: !current.withKelly
                                    }))
                                  }
                                  className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition ${entry.withKelly ? 'border-[rgba(0,102,179,0.32)] bg-[rgba(0,102,179,0.18)]' : 'border-[rgba(118,31,47,0.14)] bg-[rgba(34,58,86,0.08)]'}`}
                                >
                                  <span
                                    className={`inline-block h-6 w-6 rounded-full bg-white shadow-[0_4px_12px_rgba(26,74,122,0.2)] transition ${entry.withKelly ? 'translate-x-7' : 'translate-x-1'}`}
                                  />
                                </button>
                              </label>
                            </>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/55 p-4 text-sm text-[rgba(34,58,86,0.58)]">
                      No room types added yet.
                    </div>
                  )}
                </div>
                ) : null}

                {draft.stayType !== 'BUCKET_LIST' ? (
                <div className="space-y-3 md:col-span-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-[rgb(var(--page-foreground))]">
                        {draft.stayType === 'EXPLORED' ? 'Travel Timeline' : 'Planned Stay Timing'}
                      </div>
                      <div className="mt-1 text-xs text-[rgba(34,58,86,0.58)]">
                        {draft.stayType === 'EXPLORED'
                          ? 'Add each month and year you stayed at this property. Multiple stays in the same month are allowed.'
                          : 'Add the month and year for your planned stay. If you have multiple upcoming stays, add each one.'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={addStayEntry}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-[rgba(0,102,179,0.16)] bg-white/82 px-4 py-2 text-sm font-semibold text-[rgb(var(--wine))] transition hover:bg-[rgba(0,102,179,0.06)]"
                    >
                      {draft.stayType === 'EXPLORED' ? 'Add stay' : 'Add planned stay'}
                    </button>
                  </div>

                  {draft.stayEntries.length ? (
                    <div className="space-y-3">
                      {draft.stayEntries.map((entry, index) => (
                        <div
                          key={entry.id}
                          className="grid gap-3 rounded-[20px] border border-[rgba(0,102,179,0.1)] bg-white/72 p-3 md:grid-cols-[minmax(0,1fr)_9rem_auto]"
                        >
                          <FancySelect
                            value={String(entry.month)}
                            onChange={(value) =>
                              updateStayEntry(index, (current) => ({
                                ...current,
                                month: Number(value)
                              }))
                            }
                            options={MONTH_OPTIONS}
                          />

                          <input
                            type="number"
                            min={1900}
                            max={2100}
                            value={entry.year}
                            onChange={(event) =>
                              updateStayEntry(index, (current) => ({
                                ...current,
                                year: Number(event.target.value)
                              }))
                            }
                            placeholder="2026"
                            className="w-full rounded-[16px] border border-[rgba(118,31,47,0.14)] bg-white/92 px-4 py-3 text-sm text-[rgb(var(--page-foreground))] outline-none transition focus:border-[rgba(118,31,47,0.32)] focus:ring-4 focus:ring-[rgba(118,31,47,0.08)]"
                          />

                          <button
                            type="button"
                            onClick={() => removeStayEntry(index)}
                            className="inline-flex items-center justify-center rounded-full border border-[rgba(163,33,48,0.18)] bg-[rgba(163,33,48,0.08)] px-4 py-2 text-sm font-semibold text-[#a32130] transition hover:bg-[rgba(163,33,48,0.12)]"
                          >
                            Remove
                          </button>

                          {draft.stayType === 'EXPLORED' ? (
                            <label className="md:col-span-3 flex items-center justify-between gap-4 rounded-[16px] border border-[rgba(0,102,179,0.1)] bg-white/72 px-4 py-3">
                              <div>
                                <div className="text-sm font-semibold text-[rgb(var(--page-foreground))]">This stay was with Kelly ❤️❤️</div>
                              </div>

                              <button
                                type="button"
                                role="switch"
                                aria-checked={entry.withKelly}
                                onClick={() =>
                                  updateStayEntry(index, (current) => ({
                                    ...current,
                                    withKelly: !current.withKelly
                                  }))
                                }
                                className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition ${entry.withKelly ? 'border-[rgba(0,102,179,0.32)] bg-[rgba(0,102,179,0.18)]' : 'border-[rgba(118,31,47,0.14)] bg-[rgba(34,58,86,0.08)]'}`}
                              >
                                <span
                                  className={`inline-block h-6 w-6 rounded-full bg-white shadow-[0_4px_12px_rgba(26,74,122,0.2)] transition ${entry.withKelly ? 'translate-x-7' : 'translate-x-1'}`}
                                />
                              </button>
                            </label>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-[rgba(0,102,179,0.16)] bg-white/55 p-4 text-sm text-[rgba(34,58,86,0.58)]">
                      {draft.stayType === 'EXPLORED' ? 'No stay months added yet.' : 'No planned stay months added yet.'}
                    </div>
                  )}
                </div>
                ) : null}
              </div>

              {errorMessage ? (
                <div className="rounded-[18px] border border-[rgba(118,31,47,0.18)] bg-[rgba(118,31,47,0.06)] px-4 py-3 text-sm text-[rgb(var(--wine))]">
                  {errorMessage}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 border-t border-[rgba(118,31,47,0.1)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {modalState.mode === 'edit' ? (
                    <button
                      type="button"
                      onClick={() => void handleDelete()}
                      disabled={isSaving}
                      className="rounded-full border border-[rgba(163,33,48,0.18)] bg-[rgba(163,33,48,0.08)] px-5 py-2.5 text-sm font-semibold text-[#a32130] transition hover:bg-[rgba(163,33,48,0.12)] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      Delete hotel
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-full border border-[rgba(118,31,47,0.16)] bg-white/82 px-5 py-2.5 text-sm font-semibold text-[rgb(var(--page-foreground))] transition hover:bg-[rgba(118,31,47,0.06)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-full bg-[rgb(var(--wine))] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#004f8d] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSaving
                      ? 'Saving...'
                      : modalState.mode === 'edit'
                        ? 'Save changes'
                        : 'Add hotel'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}