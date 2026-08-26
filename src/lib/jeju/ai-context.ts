import "server-only";

import { getDistanceInMeters } from "@/lib/jeju/checkin";
import { getJejuOverview, getJejuProfile, listJejuPlaces, listJejuPrograms } from "@/lib/jeju/service";
import type { JejuPlace } from "@/lib/jeju/types";
import { cleanText, supabaseRequest } from "@/lib/supabaseServer";

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
  const distance = currentLocation
    ? Math.round(getDistanceInMeters(currentLocation, place))
    : null;
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
  const [profile, overview, places, programs, reviewRows] = await Promise.all([
    getJejuProfile(input.email),
    getJejuOverview(input.email),
    listJejuPlaces(),
    listJejuPrograms(input.email),
    supabaseRequest<UserReviewRow[]>(
      `jeju_reviews?select=place_id,overall_rating,review_text,what_liked,would_recommend&user_email=eq.${encodeURIComponent(input.email)}&order=updated_at.desc&limit=30`
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
  const openPrograms = programs
    .filter((program) => program.status === "open")
    .slice(0, 8)
    .map((program) => `- ${program.titleEn || program.title} | semester=${program.semester} | capacity=${program.capacityMin}-${program.capacityMax} | starts=${program.startsAt || "to be confirmed"} | meeting=${program.meetingPlace || "to be confirmed"} | my_application=${program.myApplication?.status || "none"}`);

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
        profile.foodWantToTry.length ? `wants_to_try=${profile.foodWantToTry.join(", ")}` : ""
      ].filter(Boolean)
    : ["No Jeju preference profile has been completed yet. Ask only the minimum follow-up question needed."];

  const text = [
    "JEJU EXPLORER CURRENT-USER CONTEXT",
    "This is private context for the current signed-in user. Do not disclose email addresses, internal ids, or data about other users.",
    "Prioritize the Jeju Explorer records below. Never invent a place, price, rating, menu, opening hour, or safety claim. If records do not answer the question, say the Jeju map needs more confirmed data and offer a clearly marked web check only when useful.",
    "Known allergies and restrictions are safety requirements. Do not recommend a conflicting place without a clear warning.",
    "USER PREFERENCES",
    ...profileLines,
    `VISIT SUMMARY: ${overview.stats.placesExplored} unique places explored; ${overview.stats.restaurants} restaurants/cafes; ${overview.stats.attractions} attractions; ${overview.stats.hiddenSpots} hidden spots.`,
    currentLocation ? `CURRENT LOCATION: user voluntarily shared a one-time location for this request (${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}). Do not repeat coordinates in the answer; use them only for distance ordering.` : "CURRENT LOCATION: not shared for this request.",
    "UNVISITED JEJU EXPLORER PLACES",
    ...(unvisitedPlaces.length > 0 ? unvisitedPlaces.map((place) => summarizePlace(place, currentLocation)) : ["- No unvisited active places are currently stored in Jeju Explorer."]),
    "CURRENT USER'S RECENT JEJU REVIEWS",
    ...(userReviews.length > 0 ? userReviews : ["- No Jeju reviews recorded yet."]),
    "CURRENT OPEN JEJU PROGRAMS",
    ...(openPrograms.length > 0 ? openPrograms : ["- No open Jeju programs are currently stored in K_LINE."])
  ].join("\n");

  return {
    hasPlaces: places.length > 0,
    text
  };
}
