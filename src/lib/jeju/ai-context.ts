import "server-only";

import { getDistanceInMeters } from "@/lib/jeju/checkin";
import {
  getJejuOverview,
  getJejuProfile,
  listJejuExploreTracking,
  listJejuPersonalPlaceRecords,
  listJejuPlaces,
  listJejuPrograms
} from "@/lib/jeju/service";
import type { JejuPlace } from "@/lib/jeju/types";
import { cleanText, supabaseRequest } from "@/lib/supabaseServer";
import { ensureUserActivityRecords } from "@/lib/userActivityRecords";

type CurrentLocation = {
  latitude: number;
  longitude: number;
};

type UserReviewRow = {
  place_id: string;
  overall_rating: number;
  review_text: string | null;
  what_liked: string | null;
  would_recommend: boolean | null;
};

type ActivityRecordRow = {
  source: "ecc" | "hanhwal";
  activity_title_snapshot: string;
  activity_date_snapshot: string;
  rating: number | null;
};

function readCurrentLocation(value: unknown): CurrentLocation | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { latitude?: unknown; longitude?: unknown };
  const latitude = Number(candidate.latitude);
  const longitude = Number(candidate.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return { latitude, longitude };
}

function summarizePlace(place: JejuPlace, currentLocation: CurrentLocation | null) {
  const distance = currentLocation ? Math.round(getDistanceInMeters(currentLocation, place)) : null;
  const details = [
    place.nameEn || place.name,
    `category=${place.category}`,
    place.address ? `address=${place.address}` : "",
    place.averageRating > 0 ? `average_rating=${place.averageRating}/5` : "",
    place.reviewCount > 0 ? `reviews=${place.reviewCount}` : "",
    place.priceRange !== "unknown" ? `price=${place.priceRange}` : "",
    place.vegetarianSupported ? "vegetarian=yes" : "",
    place.veganSupported ? "vegan=yes" : "",
    place.englishFriendly ? "english_friendly=yes" : "",
    place.allergyInfo ? `allergy_note=${cleanText(place.allergyInfo, 220)}` : "",
    place.foodFeatures.length ? `features=${place.foodFeatures.join(", ")}` : "",
    place.recommendedMenu.length ? `recommended=${place.recommendedMenu.join(", ")}` : "",
    distance === null ? "" : `distance_meters=${distance}`
  ].filter(Boolean);

  return `- ${details.join(" | ")}`;
}

export async function buildJejuWoohyukmonContext(input: {
  email: string;
  currentLocation?: unknown;
}) {
  const currentLocation = readCurrentLocation(input.currentLocation);
  await ensureUserActivityRecords(input.email).catch(() => false);

  const [profile, overview, places, programs, reviewRows, personalPlaces, tracking, activityRows] = await Promise.all([
    getJejuProfile(input.email),
    getJejuOverview(input.email),
    listJejuPlaces(),
    listJejuPrograms(input.email),
    supabaseRequest<UserReviewRow[]>(
      `jeju_reviews?select=place_id,overall_rating,review_text,what_liked,would_recommend&user_email=eq.${encodeURIComponent(input.email)}&order=updated_at.desc&limit=30`
    ),
    listJejuPersonalPlaceRecords(input.email),
    listJejuExploreTracking(input.email),
    supabaseRequest<ActivityRecordRow[]>(
      `user_activity_records?select=source,activity_title_snapshot,activity_date_snapshot,rating&user_id=eq.${encodeURIComponent(input.email)}&order=activity_date_snapshot.desc&limit=80`
    )
  ]);

  const visitedPlaceIds = new Set(overview.visits.map((visit) => visit.placeId));
  const unvisitedPlaces = places
    .filter((place) => !visitedPlaceIds.has(place.id))
    .sort((left, right) => {
      if (!currentLocation) return right.averageRating - left.averageRating || right.reviewCount - left.reviewCount;
      return getDistanceInMeters(currentLocation, left) - getDistanceInMeters(currentLocation, right);
    })
    .slice(0, 18);

  const placeById = new Map(places.map((place) => [place.id, place]));
  const userReviews = reviewRows.slice(0, 12).map((review) => {
    const place = placeById.get(review.place_id);
    return `- ${place?.nameEn || place?.name || "Visited place"} | rating=${review.overall_rating}/5 | recommended=${review.would_recommend !== false ? "yes" : "no"} | liked=${cleanText(review.what_liked, 280)} | review=${cleanText(review.review_text, 420)}`;
  });

  const personalPlaceLines = personalPlaces.slice(0, 40).map((place) =>
    `- ${cleanText(place.placeName, 220)} | category=${place.category} | rating=${place.rating}/5 | address=${cleanText(place.formattedAddress, 300)} | note=${cleanText(place.note, 320)} | user_photos=${place.photos.length} | location=${place.latitude.toFixed(4)},${place.longitude.toFixed(4)}`
  );

  const activityLines = activityRows.slice(0, 40).map((activity) =>
    `- ${cleanText(activity.activity_title_snapshot, 260)} | source=${activity.source} | date=${activity.activity_date_snapshot} | rating=${activity.rating ?? "not rated"}`
  );

  const recentPoints = tracking.points.slice(-80);
  const movementLines = recentPoints.length
    ? recentPoints.map((point) => `- ${point.recordedAt} | ${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`)
    : ["- No exploration movement points recorded yet."];

  const openPrograms = programs
    .filter((program) => program.status === "open")
    .slice(0, 8)
    .map((program) => `- ${program.titleEn || program.title} | semester=${program.semester} | starts=${program.startsAt || "to be confirmed"} | meeting=${program.meetingPlace || "to be confirmed"} | my_application=${program.myApplication?.status || "none"}`);

  const profileLines = profile
    ? [
        profile.allergies.length ? `allergies=${profile.allergies.join(", ")}` : "",
        profile.dietaryRestrictions.length ? `dietary_restrictions=${profile.dietaryRestrictions.join(", ")}` : "",
        `vegetarian=${profile.vegetarian ? "yes" : "no"}`,
        `vegan=${profile.vegan ? "yes" : "no"}`,
        `spicy_preference=${profile.spicyFoodPreference}`,
        `seafood_preference=${profile.seafoodPreference}`,
        `budget=${profile.budgetPreference}`,
        profile.preferredFoods.length ? `preferred_foods=${profile.preferredFoods.join(", ")}` : "",
        profile.preferredActivities.length ? `preferred_activities=${profile.preferredActivities.join(", ")}` : "",
        profile.foodWantToTry.length ? `wants_to_try=${profile.foodWantToTry.join(", ")}` : "",
        profile.placesWantToVisit.length ? `places_to_visit=${profile.placesWantToVisit.join(", ")}` : ""
      ].filter(Boolean)
    : ["No exploration preference profile has been completed yet. Ask only the minimum follow-up question needed."];

  const text = [
    "K_LINE KOREA MEMORY BOOK CURRENT-USER CONTEXT",
    "This is private context for the current signed-in user. Never disclose email addresses, internal ids, or data about other users.",
    "The experience map is now South Korea-wide. Some legacy table and code names still say Jeju; do not describe the service as Jeju-only.",
    "Recommendation priority: (1) experiences similar to places or activities the user rated highly, (2) nearby unvisited places, (3) the user's stated interests and preferred activities, (4) Korean cultural experiences, (5) a natural next stop based on recent movement patterns.",
    "ECC and Hanhwal history is taste evidence only. Do NOT recommend rejoining, returning to, or attending future ECC/Hanhwal activities unless the user explicitly asks for club recommendations.",
    "Known allergies and restrictions are safety requirements. Do not recommend a conflicting food place without a clear warning.",
    "Movement coordinates are private reasoning data. Never repeat exact coordinates in the answer. Use them only to infer proximity and movement direction.",
    "USER PREFERENCES",
    ...profileLines,
    `EXPERIENCE SUMMARY: ${personalPlaces.length} personal map places; ${activityRows.length} stored activities; ${tracking.sessions.length} exploration sessions; ${tracking.points.length} reduced movement points; ${overview.stats.placesExplored} verified check-ins.`,
    currentLocation ? `CURRENT LOCATION: user voluntarily shared a one-time location for this request (${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}). Do not repeat coordinates.` : "CURRENT LOCATION: not shared for this request.",
    "CURRENT USER'S SOUTH KOREA PERSONAL PLACE RECORDS",
    ...(personalPlaceLines.length ? personalPlaceLines : ["- No personal map places saved yet."]),
    "CURRENT USER'S ACTIVITY HISTORY",
    ...(activityLines.length ? activityLines : ["- No activity history recorded yet."]),
    "CURRENT USER'S RECENT MOVEMENT RECORD",
    ...movementLines,
    "CURRENT USER'S VERIFIED PLACE REVIEWS",
    ...(userReviews.length ? userReviews : ["- No verified place reviews recorded yet."]),
    "UNVISITED K_LINE VERIFIED PLACES",
    ...(unvisitedPlaces.length ? unvisitedPlaces.map((place) => summarizePlace(place, currentLocation)) : ["- No unvisited verified places are currently stored."]),
    "CURRENT OPEN K_LINE EXPLORATION PROGRAMS",
    ...(openPrograms.length ? openPrograms : ["- No open exploration programs are currently stored."])
  ].join("\n");

  return {
    hasPlaces: places.length > 0 || personalPlaces.length > 0,
    text
  };
}
