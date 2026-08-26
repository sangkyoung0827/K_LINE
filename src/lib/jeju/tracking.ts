import { getDistanceInMeters } from "@/lib/jeju/checkin";

export const TRACK_POINT_MIN_DISTANCE_METERS = 35;
export const TRACK_POINT_MIN_INTERVAL_MS = 60_000;
export const TRACK_POINT_STATIONARY_INTERVAL_MS = 5 * 60_000;

export type ExploreLocation = {
  latitude: number;
  longitude: number;
};

export type ExploreTrackSample = ExploreLocation & {
  recordedAt: string | number | Date;
};

export function isValidJejuLocation(location: ExploreLocation) {
  return Number.isFinite(location.latitude)
    && Number.isFinite(location.longitude)
    && location.latitude >= 32.7
    && location.latitude <= 34.1
    && location.longitude >= 125.7
    && location.longitude <= 127.5;
}

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
