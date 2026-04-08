import type { HotelRecord, HyattBrand, StayType, Tier } from './types';

export const TIERS = ['S', 'A', 'B', 'C', 'D'] as const;

export const BRAND_SEGMENTS = [
  'Luxury',
  'Lifestyle',
  'Classics',
  'Essentials',
  'More to Explore',
  'Inclusive'
] as const;

export const HYATT_BRANDS: HyattBrand[] = [
  { name: 'Park Hyatt', color: '#7F1D1D', segment: 'Luxury' },
  { name: 'Alila', color: '#2DD4BF', segment: 'Luxury' },
  { name: 'Miraval', color: '#F59E0B', segment: 'Luxury' },
  { name: 'Impression by Secrets', color: '#D946EF', segment: 'Luxury' },
  { name: 'The Unbound Collection by Hyatt', color: '#4F46E5', segment: 'Luxury' },
  { name: 'Andaz', color: '#FB7185', segment: 'Lifestyle' },
  { name: 'Thompson Hotels', color: '#64748B', segment: 'Lifestyle' },
  { name: 'Dream Hotels', color: '#E879F9', segment: 'Lifestyle' },
  { name: 'The Standard', color: '#111111', segment: 'Lifestyle' },
  { name: 'The StandardX', color: '#38BDF8', segment: 'Lifestyle' },
  { name: 'JdV by Hyatt', color: '#A3E635', segment: 'Lifestyle' },
  { name: 'Bunkhouse Hotels', color: '#B45309', segment: 'Lifestyle' },
  { name: 'Me and All Hotels', color: '#FB923C', segment: 'Lifestyle' },
  { name: 'Zoetry Wellness & Spa Resorts', color: '#0F766E', segment: 'Inclusive' },
  { name: 'Hyatt Ziva', color: '#0891B2', segment: 'Inclusive' },
  { name: 'Hyatt Zilara', color: '#0EA5A4', segment: 'Inclusive' },
  { name: 'Secrets Resorts & Spas', color: '#0D9488', segment: 'Inclusive' },
  { name: 'Breathless Resorts & Spas', color: '#06B6D4', segment: 'Inclusive' },
  { name: 'Dreams Resorts & Spas', color: '#38BDF8', segment: 'Inclusive' },
  { name: 'Hyatt Vivid Hotels & Resorts', color: '#14B8A6', segment: 'Inclusive' },
  { name: 'Alua Hotels & Resorts', color: '#0284C7', segment: 'Inclusive' },
  { name: 'Sunscape Resorts & Spas', color: '#22D3EE', segment: 'Inclusive' },
  { name: 'Bahia Principle', color: '#2DD4BF', segment: 'Inclusive' },
  { name: 'Grand Hyatt', color: '#1E3A8A', segment: 'Classics' },
  { name: 'Hyatt Regency', color: '#EC4899', segment: 'Classics' },
  { name: 'Hyatt', color: '#EF4444', segment: 'Classics' },
  { name: 'Hyatt Vacation Club', color: '#818CF8', segment: 'Classics' },
  { name: 'Hyatt Centric', color: '#F97316', segment: 'Classics' },
  { name: 'Destination by Hyatt', color: '#15803D', segment: 'Classics' },
  { name: 'Caption by Hyatt', color: '#D97706', segment: 'Essentials' },
  { name: 'Hyatt Place', color: '#3B82F6', segment: 'Essentials' },
  { name: 'Hyatt House', color: '#65A30D', segment: 'Essentials' },
  { name: 'Hyatt Studios', color: '#8B5CF6', segment: 'Essentials' },
  { name: 'Hyatt Select', color: '#06B6D4', segment: 'Essentials' },
  { name: 'UrCove', color: '#0F766E', segment: 'Essentials' },
  { name: 'Unscripted by Hyatt', color: '#84CC16', segment: 'Essentials' },
  { name: 'Mr & Mrs Smith', color: '#A855F7', segment: 'More to Explore' },
  { name: 'The Venetian Resort', color: '#C2410C', segment: 'More to Explore' }
];

export const BRAND_BY_NAME = Object.fromEntries(
  HYATT_BRANDS.map((brand) => [brand.name, brand])
) as Record<string, HyattBrand>;

export const BRANDS_BY_SEGMENT = BRAND_SEGMENTS.map((segment) => ({
  segment,
  brands: HYATT_BRANDS.filter((brand) => brand.segment === segment)
}));

const TIER_WEIGHT: Record<Tier, number> = {
  S: 0,
  A: 1,
  B: 2,
  C: 3,
  D: 4
};

const STAY_TYPE_WEIGHT: Record<StayType, number> = {
  EXPLORED: 0,
  FUTURE: 1,
  BUCKET_LIST: 2
};

export function sortHotelsByTier(hotels: HotelRecord[]) {
  return [...hotels].sort((left, right) => {
    const byStayType = STAY_TYPE_WEIGHT[left.stayType] - STAY_TYPE_WEIGHT[right.stayType];

    if (byStayType !== 0) {
      return byStayType;
    }

    if (left.tier === null && right.tier === null) {
      const byPositionOnly = left.position - right.position;

      if (byPositionOnly !== 0) {
        return byPositionOnly;
      }

      const byNameOnly = left.name.localeCompare(right.name);

      if (byNameOnly !== 0) {
        return byNameOnly;
      }

      return left.brand.localeCompare(right.brand);
    }

    if (left.tier === null) {
      return 1;
    }

    if (right.tier === null) {
      return -1;
    }

    const byTier = TIER_WEIGHT[left.tier] - TIER_WEIGHT[right.tier];

    if (byTier !== 0) {
      return byTier;
    }

    const byPosition = left.position - right.position;

    if (byPosition !== 0) {
      return byPosition;
    }

    const byName = left.name.localeCompare(right.name);

    if (byName !== 0) {
      return byName;
    }

    return left.brand.localeCompare(right.brand);
  });
}