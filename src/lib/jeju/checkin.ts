export const CHECK_IN_RADIUS_METERS = 150;

export function getDistanceInMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
) {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const startLatitude = toRadians(from.latitude);
  const endLatitude = toRadians(to.latitude);
  const sinLatitude = Math.sin(latitudeDelta / 2);
  const sinLongitude = Math.sin(longitudeDelta / 2);
  const a = sinLatitude * sinLatitude + Math.cos(startLatitude) * Math.cos(endLatitude) * sinLongitude * sinLongitude;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWithinCheckInRadius(
  current: { latitude: number; longitude: number },
  place: { latitude: number; longitude: number },
  radiusMeters = CHECK_IN_RADIUS_METERS
) {
  return getDistanceInMeters(current, place) <= radiusMeters;
}
