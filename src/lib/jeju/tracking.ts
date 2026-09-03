import { getDistanceInMeters } from "@/lib/jeju/checkin";

export const TRACK_POINT_MIN_DISTANCE_METERS = 35;
export const TRACK_POINT_MIN_INTERVAL_MS = 60_000;
export const TRACK_POINT_STATIONARY_INTERVAL_MS = 5 * 60_000;

export const KOREA_LOCATION_BOUNDS = {
  south: 32.8,
  north: 38.8,
  west: 124.3,
  east: 132.2
} as const;

export type ExploreLocation = {
  latitude: number;
  longitude: number;
};

export type ExploreTrackSample = ExploreLocation & {
  recordedAt: string | number | Date;
};

export function isValidKoreaLocation(location: ExploreLocation) {
  return Number.isFinite(location.latitude)
    && Number.isFinite(location.longitude)
    && location.latitude >= KOREA_LOCATION_BOUNDS.south
    && location.latitude <= KOREA_LOCATION_BOUNDS.north
    && location.longitude >= KOREA_LOCATION_BOUNDS.west
    && location.longitude <= KOREA_LOCATION_BOUNDS.east;
}

// Kept as a compatibility alias so the existing exploration service can stay untouched.
export const isValidJejuLocation = isValidKoreaLocation;

export function roundExploreCoordinate(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

export function shouldPersistTrackPoint(
  previous: ExploreTrackSample | null,
  next: ExploreTrackSample
) {
  if (!previous) return true;

  const previousTime = new Date(previous.recordedAt).getTime();
  const nextTime = new Date(next.recordedAt).getTime();
  const elapsed = Number.isFinite(previousTime) && Number.isFinite(nextTime)
    ? Math.max(0, nextTime - previousTime)
    : TRACK_POINT_MIN_INTERVAL_MS;
  const distance = getDistanceInMeters(previous, next);

  if (distance >= TRACK_POINT_MIN_DISTANCE_METERS && elapsed >= TRACK_POINT_MIN_INTERVAL_MS) {
    return true;
  }

  return elapsed >= TRACK_POINT_STATIONARY_INTERVAL_MS;
}
