import "server-only";

import { auth } from "@/auth";
import { normalizeEmail } from "@/lib/admin";
import { getDistanceInMeters, CHECK_IN_RADIUS_METERS } from "@/lib/jeju/checkin";
import { getJejuAccessForEmail } from "@/lib/jeju/access";
import {
  jejuPlaceCategories,
  type JejuAccess,
  type JejuExplorerOverview,
  type JejuMemory,
  type JejuPlace,
  type JejuPlaceCategory,
  type JejuPriceRange,
  type JejuProfile,
  type JejuProgram,
  type JejuProgramApplication,
  type JejuReview,
  type JejuReviewPhoto,
  type JejuVisit
} from "@/lib/jeju/types";
import { cleanText, SupabaseRequestError, supabaseRequest } from "@/lib/supabaseServer";

type JejuPlaceRow = {
  id: string;
  slug: string;
  name: string;
  name_en: string | null;
  category: string;
  latitude: number | string;
  longitude: number | string;
  address: string | null;
  description: string | null;
  description_en: string | null;
  thumbnail_url: string | null;
  thumbnail_path: string | null;
  average_rating: number | string | null;
  review_count: number | null;
  recommendation_percentage: number | string | null;
  price_range: string | null;
  atmosphere: string | null;
  food_features: string[] | null;
  recommended_menu: string[] | null;
  allergy_info: string | null;
  vegetarian_supported: boolean | null;
  vegan_supported: boolean | null;
  english_friendly: boolean | null;
  tags: string[] | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string | null;
};

type JejuProfileRow = {
  user_email: string;
  display_name: string | null;
  allergies: string[] | null;
  dietary_restrictions: string[] | null;
  vegetarian: boolean | null;
  vegan: boolean | null;
  spicy_food_preference: string | null;
  seafood_preference: string | null;
  budget_preference: string | null;
  preferred_foods: string[] | null;
  preferred_activities: string[] | null;
  places_want_to_visit: string[] | null;
  food_want_to_try: string[] | null;
  updated_at: string | null;
};

type JejuVisitRow = {
  id: string;
  user_email: string;
  place_id: string;
  visited_at: string;
  checkin_distance_meters: number | null;
  created_at: string;
};

type JejuReviewRow = {
  id: string;
  place_id: string;
  visit_id: string | null;
  user_email: string;
  display_name: string | null;
  overall_rating: number | null;
  food_rating: number | null;
  price_rating: number | null;
  atmosphere_rating: number | null;
  what_liked: string | null;
  could_be_better: string | null;
  review_text: string | null;
  would_recommend: boolean | null;
  is_public: boolean | null;
  status: "published" | "hidden" | null;
  created_at: string;
  updated_at: string | null;
};

type JejuReviewPhotoRow = {
  id: string;
  review_id: string;
  storage_path: string;
  public_url: string;
};

type JejuMemoryRow = {
  id: string;
  user_email: string;
  place_id: string | null;
  visit_id: string | null;
  title: string | null;
  note: string | null;
  rating: number | null;
  created_at: string;
  updated_at: string | null;
};

type JejuProgramRow = {
  id: string;
  slug: string;
  title: string;
  title_en: string | null;
  description: string | null;
  description_en: string | null;
  semester: string;
  capacity_min: number | null;
  capacity_max: number | null;
  starts_at: string | null;
  ends_at: string | null;
  meeting_place: string | null;
  status: "draft" | "open" | "closed" | "completed" | null;
  created_at: string;
  updated_at: string | null;
};

type JejuProgramApplicationRow = {
  id: string;
  program_id: string;
  user_email: string;
  display_name: string | null;
  allergies: string[] | null;
  food_preferences: string[] | null;
  foods_want_to_try: string[] | null;
  restaurants_want_to_visit: string[] | null;
  attractions_want_to_visit: string[] | null;
  dietary_restrictions: string[] | null;
  spicy_food_tolerance: string | null;
  seafood_preference: string | null;
  budget_preference: string | null;
  interested_activities: string[] | null;
  status: "submitted" | "waitlist" | "approved" | "rejected" | "cancelled" | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string | null;
};

export class JejuHttpError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "JEJU_REQUEST_FAILED"
  ) {
    super(message);
  }
}

const placeColumns =
  "id,slug,name,name_en,category,latitude,longitude,address,description,description_en,thumbnail_url,thumbnail_path,average_rating,review_count,recommendation_percentage,price_range,atmosphere,food_features,recommended_menu,allergy_info,vegetarian_supported,vegan_supported,english_friendly,tags,is_active,created_at,updated_at";
const profileColumns =
  "user_email,display_name,allergies,dietary_restrictions,vegetarian,vegan,spicy_food_preference,seafood_preference,budget_preference,preferred_foods,preferred_activities,places_want_to_visit,food_want_to_try,updated_at";
const visitColumns = "id,user_email,place_id,visited_at,checkin_distance_meters,created_at";
const reviewColumns =
  "id,place_id,visit_id,user_email,display_name,overall_rating,food_rating,price_rating,atmosphere_rating,what_liked,could_be_better,review_text,would_recommend,is_public,status,created_at,updated_at";
const reviewPhotoColumns = "id,review_id,storage_path,public_url";
const memoryColumns = "id,user_email,place_id,visit_id,title,note,rating,created_at,updated_at";
const programColumns =
  "id,slug,title,title_en,description,description_en,semester,capacity_min,capacity_max,starts_at,ends_at,meeting_place,status,created_at,updated_at";
const programApplicationColumns =
  "id,program_id,user_email,display_name,allergies,food_preferences,foods_want_to_try,restaurants_want_to_visit,attractions_want_to_visit,dietary_restrictions,spicy_food_tolerance,seafood_preference,budget_preference,interested_activities,status,admin_note,created_at,updated_at";

function numberValue(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asStringArray(value: unknown, limit = 16, itemLimit = 160) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]/g)
      : [];

  return Array.from(
    new Set(
      raw
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, itemLimit))
        .filter(Boolean)
    )
  ).slice(0, limit);
}

function categoryValue(value: unknown): JejuPlaceCategory {
  return typeof value === "string" && (jejuPlaceCategories as readonly string[]).includes(value)
    ? (value as JejuPlaceCategory)
    : "other";
}

function priceRangeValue(value: unknown): JejuPriceRange {
  return value === "budget" || value === "moderate" || value === "premium" ? value : "unknown";
}

function ratingValue(value: unknown, required = true) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 1 || number > 5) {
    if (!required && (value === null || value === undefined || value === "")) return null;
    throw new JejuHttpError("Ratings must be whole numbers from 1 to 5.", 400, "JEJU_INVALID_RATING");
  }

  return number;
}

function booleanValue(value: unknown) {
  return value === true || value === "true";
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T) {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function safeUuid(value: unknown, label = "Identifier") {
  const id = cleanText(value, 120);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new JejuHttpError(`${label} is invalid.`, 400, "JEJU_INVALID_IDENTIFIER");
  }
  return id;
}

function buildSlug(value: string) {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54);
  return cleaned || "jeju-place";
}

function uniqueSlugBase(name: string, nameEn: string) {
  return `${buildSlug(nameEn || name)}-${Date.now().toString(36)}`.slice(0, 72);
}

function toPlace(row: JejuPlaceRow): JejuPlace {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameEn: row.name_en ?? "",
    category: categoryValue(row.category),
    latitude: numberValue(row.latitude),
    longitude: numberValue(row.longitude),
    address: row.address ?? "",
    description: row.description ?? "",
    descriptionEn: row.description_en ?? "",
    thumbnailUrl: row.thumbnail_url ?? "",
    thumbnailPath: row.thumbnail_path ?? "",
    averageRating: numberValue(row.average_rating),
    reviewCount: Number(row.review_count ?? 0),
    recommendationPercentage: numberValue(row.recommendation_percentage),
    priceRange: priceRangeValue(row.price_range),
    atmosphere: row.atmosphere ?? "",
    foodFeatures: row.food_features ?? [],
    recommendedMenu: row.recommended_menu ?? [],
    allergyInfo: row.allergy_info ?? "",
    vegetarianSupported: Boolean(row.vegetarian_supported),
    veganSupported: Boolean(row.vegan_supported),
    englishFriendly: Boolean(row.english_friendly),
    tags: row.tags ?? [],
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at
  };
}

function toProfile(row: JejuProfileRow): JejuProfile {
  return {
    userEmail: row.user_email,
    displayName: row.display_name ?? "",
    allergies: row.allergies ?? [],
    dietaryRestrictions: row.dietary_restrictions ?? [],
    vegetarian: Boolean(row.vegetarian),
    vegan: Boolean(row.vegan),
    spicyFoodPreference: enumValue(row.spicy_food_preference, ["none", "mild", "medium", "high"] as const, "medium"),
    seafoodPreference: enumValue(row.seafood_preference, ["avoid", "neutral", "like"] as const, "neutral"),
    budgetPreference: enumValue(row.budget_preference, ["budget", "moderate", "premium"] as const, "moderate"),
    preferredFoods: row.preferred_foods ?? [],
    preferredActivities: row.preferred_activities ?? [],
    placesWantToVisit: row.places_want_to_visit ?? [],
    foodWantToTry: row.food_want_to_try ?? [],
    updatedAt: row.updated_at ?? new Date(0).toISOString()
  };
}

function toVisit(row: JejuVisitRow): JejuVisit {
  return {
    id: row.id,
    userEmail: row.user_email,
    placeId: row.place_id,
    visitedAt: row.visited_at,
    checkinDistanceMeters: row.checkin_distance_meters,
    createdAt: row.created_at
  };
}

function toReview(row: JejuReviewRow, photos: JejuReviewPhoto[] = []): JejuReview {
  return {
    id: row.id,
    placeId: row.place_id,
    visitId: row.visit_id ?? "",
    userEmail: row.user_email,
    displayName: row.display_name ?? "Anonymous explorer",
    overallRating: Number(row.overall_rating ?? 0),
    foodRating: row.food_rating === null ? null : Number(row.food_rating),
    priceRating: Number(row.price_rating ?? 0),
    atmosphereRating: Number(row.atmosphere_rating ?? 0),
    whatLiked: row.what_liked ?? "",
    couldBeBetter: row.could_be_better ?? "",
    reviewText: row.review_text ?? "",
    wouldRecommend: row.would_recommend !== false,
    isPublic: row.is_public !== false,
    status: row.status === "hidden" ? "hidden" : "published",
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    photos
  };
}

function toReviewPhoto(row: JejuReviewPhotoRow): JejuReviewPhoto {
  return {
    id: row.id,
    reviewId: row.review_id,
    storagePath: row.storage_path,
    publicUrl: row.public_url
  };
}

function toProgram(row: JejuProgramRow, application?: JejuProgramApplication | null, applicationCount?: number): JejuProgram {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    titleEn: row.title_en ?? "",
    description: row.description ?? "",
    descriptionEn: row.description_en ?? "",
    semester: row.semester,
    capacityMin: Number(row.capacity_min ?? 25),
    capacityMax: Number(row.capacity_max ?? 35),
    startsAt: row.starts_at ?? "",
    endsAt: row.ends_at ?? "",
    meetingPlace: row.meeting_place ?? "",
    status: row.status === "open" || row.status === "closed" || row.status === "completed" ? row.status : "draft",
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    applicationCount,
    myApplication: application ?? null
  };
}

function toProgramApplication(row: JejuProgramApplicationRow): JejuProgramApplication {
  return {
    id: row.id,
    programId: row.program_id,
    userEmail: row.user_email,
    displayName: row.display_name ?? "",
    allergies: row.allergies ?? [],
    foodPreferences: row.food_preferences ?? [],
    foodsWantToTry: row.foods_want_to_try ?? [],
    restaurantsWantToVisit: row.restaurants_want_to_visit ?? [],
    attractionsWantToVisit: row.attractions_want_to_visit ?? [],
    dietaryRestrictions: row.dietary_restrictions ?? [],
    spicyFoodTolerance: row.spicy_food_tolerance ?? "medium",
    seafoodPreference: row.seafood_preference ?? "neutral",
    budgetPreference: row.budget_preference ?? "moderate",
    interestedActivities: row.interested_activities ?? [],
    status: row.status === "waitlist" || row.status === "approved" || row.status === "rejected" || row.status === "cancelled" ? row.status : "submitted",
    adminNote: row.admin_note ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at
  };
}

export async function getCurrentJejuUser() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);

  if (!email) {
    throw new JejuHttpError("Google login is required for Jeju Explorer.", 401, "JEJU_LOGIN_REQUIRED");
  }

  return {
    access: await getJejuAccessForEmail(email),
    email,
    image: session?.user?.image ?? "",
    name: session?.user?.name ?? ""
  };
}

export async function getJejuProfile(email: string) {
  const rows = await supabaseRequest<JejuProfileRow[]>(
    `jeju_user_profiles?select=${profileColumns}&user_email=eq.${encodeURIComponent(email)}&limit=1`
  );
  return rows[0] ? toProfile(rows[0]) : null;
}

async function getSiteMemberId(email: string) {
  try {
    const rows = await supabaseRequest<Array<{ id: string }>>(
      `site_members?select=id&email=eq.${encodeURIComponent(email)}&limit=1`
    );
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function saveJejuProfile(input: { email: string; name?: string | null; body: Record<string, unknown> }) {
  const existing = await getJejuProfile(input.email);
  const now = new Date().toISOString();
  const body = input.body;
  const payload = {
    display_name: cleanText(body.displayName ?? body.display_name ?? input.name, 120),
    allergies: asStringArray(body.allergies),
    dietary_restrictions: asStringArray(body.dietaryRestrictions ?? body.dietary_restrictions),
    vegetarian: booleanValue(body.vegetarian),
    vegan: booleanValue(body.vegan),
    spicy_food_preference: enumValue(body.spicyFoodPreference ?? body.spicy_food_preference, ["none", "mild", "medium", "high"] as const, "medium"),
    seafood_preference: enumValue(body.seafoodPreference ?? body.seafood_preference, ["avoid", "neutral", "like"] as const, "neutral"),
    budget_preference: enumValue(body.budgetPreference ?? body.budget_preference, ["budget", "moderate", "premium"] as const, "moderate"),
    preferred_foods: asStringArray(body.preferredFoods ?? body.preferred_foods),
    preferred_activities: asStringArray(body.preferredActivities ?? body.preferred_activities),
    places_want_to_visit: asStringArray(body.placesWantToVisit ?? body.places_want_to_visit),
    food_want_to_try: asStringArray(body.foodWantToTry ?? body.food_want_to_try),
    updated_at: now
  };

  if (existing) {
    const rows = await supabaseRequest<JejuProfileRow[]>(
      `jeju_user_profiles?user_email=eq.${encodeURIComponent(input.email)}&select=${profileColumns}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload)
      }
    );
    return rows[0] ? toProfile(rows[0]) : existing;
  }

  const rows = await supabaseRequest<JejuProfileRow[]>(`jeju_user_profiles?select=${profileColumns}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      ...payload,
      site_member_id: await getSiteMemberId(input.email),
      user_email: input.email,
      created_at: now
    })
  });
  return rows[0] ? toProfile(rows[0]) : null;
}

export async function listJejuPlaces(options: { includeInactive?: boolean } = {}) {
  const activeFilter = options.includeInactive ? "" : "&is_active=eq.true";
  const rows = await supabaseRequest<JejuPlaceRow[]>(
    `jeju_places?select=${placeColumns}${activeFilter}&order=created_at.desc&limit=400`
  );
  return rows.map(toPlace);
}

export async function getJejuPlace(placeId: string) {
  const id = safeUuid(placeId, "Place identifier");
  const rows = await supabaseRequest<JejuPlaceRow[]>(
    `jeju_places?select=${placeColumns}&id=eq.${encodeURIComponent(id)}&limit=1`
  );
  return rows[0] ? toPlace(rows[0]) : null;
}

function cleanPlacePayload(body: Record<string, unknown>, createdBy: string, existing?: JejuPlace) {
  const name = cleanText(body.name, 180) || existing?.name || "";
  const nameEn = cleanText(body.nameEn ?? body.name_en, 180) || existing?.nameEn || "";
  const latitude = Number(body.latitude ?? existing?.latitude);
  const longitude = Number(body.longitude ?? existing?.longitude);

  if (!name || !Number.isFinite(latitude) || latitude < 32.7 || latitude > 34.1 || !Number.isFinite(longitude) || longitude < 125.7 || longitude > 127.5) {
    throw new JejuHttpError("A place name and valid Jeju latitude/longitude are required.", 400, "JEJU_INVALID_PLACE");
  }

  return {
    address: cleanText(body.address, 600) || existing?.address || "",
    allergy_info: cleanText(body.allergyInfo ?? body.allergy_info, 1400) || existing?.allergyInfo || "",
    atmosphere: cleanText(body.atmosphere, 480) || existing?.atmosphere || "",
    category: categoryValue(body.category ?? existing?.category),
    created_by: createdBy,
    description: cleanText(body.description, 4000) || existing?.description || "",
    description_en: cleanText(body.descriptionEn ?? body.description_en, 4000) || existing?.descriptionEn || "",
    english_friendly: body.englishFriendly === undefined ? existing?.englishFriendly ?? false : booleanValue(body.englishFriendly),
    food_features: body.foodFeatures === undefined ? existing?.foodFeatures ?? [] : asStringArray(body.foodFeatures ?? body.food_features),
    is_active: body.isActive === undefined ? existing?.isActive ?? true : booleanValue(body.isActive),
    latitude,
    longitude,
    name,
    name_en: nameEn,
    price_range: priceRangeValue(body.priceRange ?? body.price_range ?? existing?.priceRange),
    recommended_menu: body.recommendedMenu === undefined ? existing?.recommendedMenu ?? [] : asStringArray(body.recommendedMenu ?? body.recommended_menu),
    tags: body.tags === undefined ? existing?.tags ?? [] : asStringArray(body.tags),
    thumbnail_path: cleanText(body.thumbnailPath ?? body.thumbnail_path, 1000) || existing?.thumbnailPath || "",
    thumbnail_url: cleanText(body.thumbnailUrl ?? body.thumbnail_url, 1800) || existing?.thumbnailUrl || "",
    vegan_supported: body.veganSupported === undefined ? existing?.veganSupported ?? false : booleanValue(body.veganSupported),
    vegetarian_supported: body.vegetarianSupported === undefined ? existing?.vegetarianSupported ?? false : booleanValue(body.vegetarianSupported),
    updated_at: new Date().toISOString()
  };
}

export async function createJejuPlace(body: Record<string, unknown>, createdBy: string) {
  const payload = cleanPlacePayload(body, createdBy);
  const slug = cleanText(body.slug, 80) || uniqueSlugBase(payload.name, payload.name_en);
  const rows = await supabaseRequest<JejuPlaceRow[]>(`jeju_places?select=${placeColumns}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...payload, slug })
  });
  return rows[0] ? toPlace(rows[0]) : null;
}

export async function updateJejuPlace(placeId: string, body: Record<string, unknown>, updatedBy: string) {
  const existing = await getJejuPlace(placeId);
  if (!existing) throw new JejuHttpError("This Jeju place was not found.", 404, "JEJU_PLACE_NOT_FOUND");
  const payload = cleanPlacePayload(body, updatedBy, existing);
  const rows = await supabaseRequest<JejuPlaceRow[]>(
    `jeju_places?id=eq.${encodeURIComponent(existing.id)}&select=${placeColumns}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload)
    }
  );
  return rows[0] ? toPlace(rows[0]) : existing;
}

export async function listJejuVisits(email: string) {
  const rows = await supabaseRequest<JejuVisitRow[]>(
    `jeju_visits?select=${visitColumns}&user_email=eq.${encodeURIComponent(email)}&order=visited_at.desc&limit=1000`
  );
  return rows.map(toVisit);
}

export async function checkInToJejuPlace(input: {
  email: string;
  placeId: unknown;
  latitude: unknown;
  longitude: unknown;
}) {
  const place = await getJejuPlace(safeUuid(input.placeId, "Place identifier"));
  if (!place || !place.isActive) throw new JejuHttpError("This place is not available for check-in.", 404, "JEJU_PLACE_NOT_FOUND");

  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new JejuHttpError("A valid current location is required for check-in.", 400, "JEJU_LOCATION_INVALID");
  }

  const distanceMeters = Math.round(getDistanceInMeters({ latitude, longitude }, place));
  if (distanceMeters > CHECK_IN_RADIUS_METERS) {
    return { distanceMeters, place, success: false as const, visit: null };
  }

  const now = new Date().toISOString();
  const rows = await supabaseRequest<JejuVisitRow[]>(`jeju_visits?select=${visitColumns}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      checkin_distance_meters: distanceMeters,
      // The server validates precise GPS input but stores only an approximately 100 m rounded point.
      checkin_latitude: Math.round(latitude * 1000) / 1000,
      checkin_longitude: Math.round(longitude * 1000) / 1000,
      created_at: now,
      place_id: place.id,
      updated_at: now,
      user_email: input.email,
      visited_at: now
    })
  });
  const visit = rows[0] ? toVisit(rows[0]) : null;

  if (visit) {
    await supabaseRequest<JejuMemoryRow[]>(`jeju_memories?select=${memoryColumns}`, {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
      body: JSON.stringify({
        created_at: now,
        place_id: place.id,
        title: place.nameEn || place.name,
        updated_at: now,
        user_email: input.email,
        visit_id: visit.id
      })
    });
  }

  return { distanceMeters, place, success: true as const, visit };
}

async function listReviewPhotos(reviewIds: string[]) {
  if (reviewIds.length === 0) return [];
  const rows = await supabaseRequest<JejuReviewPhotoRow[]>(
    `jeju_review_photos?select=${reviewPhotoColumns}&review_id=in.(${reviewIds.join(",")})&limit=500`
  );
  return rows.map(toReviewPhoto);
}

function groupPhotosByReview(photos: JejuReviewPhoto[]) {
  const grouped = new Map<string, JejuReviewPhoto[]>();
  photos.forEach((photo) => {
    const current = grouped.get(photo.reviewId) ?? [];
    current.push(photo);
    grouped.set(photo.reviewId, current);
  });
  return grouped;
}

export async function listJejuReviews(placeId: string, includePrivateForEmail = "") {
  const id = safeUuid(placeId, "Place identifier");
  const visibility = includePrivateForEmail
    ? `&or=(and(is_public.eq.true,status.eq.published),user_email.eq.${encodeURIComponent(includePrivateForEmail)})`
    : "&is_public=eq.true&status=eq.published";
  const rows = await supabaseRequest<JejuReviewRow[]>(
    `jeju_reviews?select=${reviewColumns}&place_id=eq.${encodeURIComponent(id)}${visibility}&order=created_at.desc&limit=200`
  );
  const photos = await listReviewPhotos(rows.map((row) => row.id));
  const photosByReview = groupPhotosByReview(photos);
  return rows.map((row) => toReview(row, photosByReview.get(row.id) ?? []));
}

function normalizePhotoInputs(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const photo = item as { publicUrl?: unknown; storagePath?: unknown };
      const publicUrl = cleanText(photo.publicUrl, 2000);
      const storagePath = cleanText(photo.storagePath, 1000);
      if (!publicUrl || !storagePath || !storagePath.startsWith("reviews/")) return [];
      return [{ publicUrl, storagePath }];
    })
    .slice(0, 5);
}

export async function saveJejuReview(input: { email: string; displayName?: string | null; body: Record<string, unknown> }) {
  const placeId = safeUuid(input.body.placeId ?? input.body.place_id, "Place identifier");
  const place = await getJejuPlace(placeId);
  if (!place) throw new JejuHttpError("This Jeju place was not found.", 404, "JEJU_PLACE_NOT_FOUND");

  const visitRows = await supabaseRequest<JejuVisitRow[]>(
    `jeju_visits?select=${visitColumns}&user_email=eq.${encodeURIComponent(input.email)}&place_id=eq.${encodeURIComponent(placeId)}&order=visited_at.desc&limit=1`
  );
  const visit = visitRows[0];
  if (!visit) throw new JejuHttpError("Only visitors who checked in can write a review.", 403, "JEJU_REVIEW_VISIT_REQUIRED");

  const existingRows = await supabaseRequest<JejuReviewRow[]>(
    `jeju_reviews?select=${reviewColumns}&user_email=eq.${encodeURIComponent(input.email)}&place_id=eq.${encodeURIComponent(placeId)}&limit=1`
  );
  const now = new Date().toISOString();
  const payload = {
    atmosphere_rating: ratingValue(input.body.atmosphereRating ?? input.body.atmosphere_rating),
    could_be_better: cleanText(input.body.couldBeBetter ?? input.body.could_be_better, 3000),
    display_name: cleanText(input.body.displayName ?? input.body.display_name ?? input.displayName, 120) || "Jeju explorer",
    food_rating:
      place.category === "restaurant" || place.category === "cafe"
        ? ratingValue(input.body.foodRating ?? input.body.food_rating, false)
        : null,
    is_public: input.body.isPublic === undefined ? true : booleanValue(input.body.isPublic),
    overall_rating: ratingValue(input.body.overallRating ?? input.body.overall_rating),
    place_id: placeId,
    price_rating: ratingValue(input.body.priceRating ?? input.body.price_rating),
    review_text: cleanText(input.body.reviewText ?? input.body.review_text, 5000),
    status: "published",
    updated_at: now,
    user_email: input.email,
    visit_id: visit.id,
    what_liked: cleanText(input.body.whatLiked ?? input.body.what_liked, 3000),
    would_recommend: input.body.wouldRecommend === undefined ? true : booleanValue(input.body.wouldRecommend)
  };

  const rows = existingRows[0]
    ? await supabaseRequest<JejuReviewRow[]>(
        `jeju_reviews?id=eq.${encodeURIComponent(existingRows[0].id)}&select=${reviewColumns}`,
        { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) }
      )
    : await supabaseRequest<JejuReviewRow[]>(`jeju_reviews?select=${reviewColumns}`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ ...payload, created_at: now })
      });
  const review = rows[0];
  if (!review) throw new JejuHttpError("The Jeju review could not be saved.", 500, "JEJU_REVIEW_SAVE_FAILED");

  const photoInputs = normalizePhotoInputs(input.body.photos);
  if (photoInputs.length > 0) {
    await supabaseRequest<JejuReviewPhotoRow[]>(`jeju_review_photos?select=${reviewPhotoColumns}`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(
        photoInputs.map((photo) => ({
          public_url: photo.publicUrl,
          review_id: review.id,
          storage_path: photo.storagePath
        }))
      )
    });
  }

  const photoRows = await listReviewPhotos([review.id]);
  return toReview(review, photoRows);
}

export async function getJejuPlaceDetail(placeId: string, email: string) {
  const place = await getJejuPlace(placeId);
  if (!place || !place.isActive) throw new JejuHttpError("This Jeju place was not found.", 404, "JEJU_PLACE_NOT_FOUND");
  const [visits, reviews] = await Promise.all([listJejuVisits(email), listJejuReviews(place.id, email)]);
  const placeVisits = visits.filter((visit) => visit.placeId === place.id);
  return {
    place,
    reviews,
    visited: placeVisits.length > 0,
    latestVisit: placeVisits[0] ?? null
  };
}

export async function listJejuMemories(email: string) {
  const [memoryRows, places, reviewRows] = await Promise.all([
    supabaseRequest<JejuMemoryRow[]>(
      `jeju_memories?select=${memoryColumns}&user_email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=1000`
    ),
    listJejuPlaces({ includeInactive: true }),
    supabaseRequest<JejuReviewRow[]>(
      `jeju_reviews?select=${reviewColumns}&user_email=eq.${encodeURIComponent(email)}&order=updated_at.desc&limit=1000`
    )
  ]);
  const photos = await listReviewPhotos(reviewRows.map((row) => row.id));
  const placeById = new Map(places.map((place) => [place.id, place]));
  const photosByPlace = new Map<string, JejuReviewPhoto[]>();
  const photosByReview = groupPhotosByReview(photos);
  reviewRows.forEach((review) => {
    const current = photosByPlace.get(review.place_id) ?? [];
    current.push(...(photosByReview.get(review.id) ?? []));
    photosByPlace.set(review.place_id, current);
  });
  const reviewByPlace = new Map(reviewRows.map((review) => [review.place_id, review]));

  return memoryRows.map<JejuMemory>((row) => ({
    id: row.id,
    placeId: row.place_id ?? "",
    visitId: row.visit_id ?? "",
    title: row.title ?? "",
    note: row.note ?? "",
    rating: row.rating ?? reviewByPlace.get(row.place_id ?? "")?.overall_rating ?? null,
    createdAt: row.created_at,
    place: placeById.get(row.place_id ?? "") ?? null,
    photos: photosByPlace.get(row.place_id ?? "") ?? []
  }));
}

export async function getJejuOverview(email: string): Promise<JejuExplorerOverview> {
  const [access, profile, places, visits] = await Promise.all([
    getJejuAccessForEmail(email),
    getJejuProfile(email),
    listJejuPlaces(),
    listJejuVisits(email)
  ]);
  const placeById = new Map(places.map((place) => [place.id, place]));
  const uniqueVisitedPlaces = Array.from(new Set(visits.map((visit) => visit.placeId)))
    .map((id) => placeById.get(id))
    .filter((place): place is JejuPlace => Boolean(place));

  return {
    access,
    profile,
    places,
    visits,
    stats: {
      placesExplored: uniqueVisitedPlaces.length,
      restaurants: uniqueVisitedPlaces.filter((place) => place.category === "restaurant" || place.category === "cafe").length,
      attractions: uniqueVisitedPlaces.filter((place) => ["attraction", "nature", "culture"].includes(place.category)).length,
      hiddenSpots: uniqueVisitedPlaces.filter((place) => place.category === "hidden_spot").length
    }
  };
}

export async function listJejuPrograms(email: string, includeNonPublic = false) {
  const filter = includeNonPublic ? "" : "&status=neq.draft";
  const [programRows, applicationRows] = await Promise.all([
    supabaseRequest<JejuProgramRow[]>(
      `jeju_programs?select=${programColumns}${filter}&order=starts_at.asc.nullslast,created_at.desc&limit=100`
    ),
    supabaseRequest<JejuProgramApplicationRow[]>(
      `jeju_program_applications?select=${programApplicationColumns}&user_email=eq.${encodeURIComponent(email)}&limit=300`
    )
  ]);
  const applicationsByProgram = new Map(applicationRows.map((row) => [row.program_id, toProgramApplication(row)]));
  return programRows.map((row) => toProgram(row, applicationsByProgram.get(row.id) ?? null));
}

function cleanProgramPayload(body: Record<string, unknown>, createdBy: string) {
  const title = cleanText(body.title, 240);
  const semester = cleanText(body.semester, 40);
  const capacityMin = Number(body.capacityMin ?? body.capacity_min ?? 25);
  const capacityMax = Number(body.capacityMax ?? body.capacity_max ?? 35);
  if (!title || !semester || !Number.isInteger(capacityMin) || !Number.isInteger(capacityMax) || capacityMin < 1 || capacityMax < capacityMin) {
    throw new JejuHttpError("Program title, semester, and capacity are required.", 400, "JEJU_INVALID_PROGRAM");
  }
  return {
    capacity_max: capacityMax,
    capacity_min: capacityMin,
    created_by: createdBy,
    description: cleanText(body.description, 5000),
    description_en: cleanText(body.descriptionEn ?? body.description_en, 5000),
    ends_at: cleanText(body.endsAt ?? body.ends_at, 80) || null,
    meeting_place: cleanText(body.meetingPlace ?? body.meeting_place, 600),
    semester,
    starts_at: cleanText(body.startsAt ?? body.starts_at, 80) || null,
    status: enumValue(body.status, ["draft", "open", "closed", "completed"] as const, "draft"),
    title,
    title_en: cleanText(body.titleEn ?? body.title_en, 240),
    updated_at: new Date().toISOString()
  };
}

export async function createJejuProgram(body: Record<string, unknown>, createdBy: string) {
  const payload = cleanProgramPayload(body, createdBy);
  const slug = cleanText(body.slug, 80) || `${buildSlug(payload.title_en || payload.title)}-${Date.now().toString(36)}`.slice(0, 72);
  const rows = await supabaseRequest<JejuProgramRow[]>(`jeju_programs?select=${programColumns}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...payload, slug })
  });
  return rows[0] ? toProgram(rows[0]) : null;
}

export async function applyToJejuProgram(input: { email: string; name?: string | null; programId: unknown; body: Record<string, unknown> }) {
  const programId = safeUuid(input.programId, "Program identifier");
  const programs = await supabaseRequest<JejuProgramRow[]>(
    `jeju_programs?select=${programColumns}&id=eq.${encodeURIComponent(programId)}&limit=1`
  );
  const program = programs[0];
  if (!program || program.status !== "open") throw new JejuHttpError("This Jeju program is not open for applications.", 400, "JEJU_PROGRAM_NOT_OPEN");

  const profile = await getJejuProfile(input.email);
  const now = new Date().toISOString();
  const body = input.body;
  const payload = {
    allergies: asStringArray(body.allergies ?? profile?.allergies),
    attractions_want_to_visit: asStringArray(body.attractionsWantToVisit ?? body.attractions_want_to_visit ?? profile?.placesWantToVisit),
    budget_preference: enumValue(body.budgetPreference ?? body.budget_preference ?? profile?.budgetPreference, ["budget", "moderate", "premium"] as const, "moderate"),
    dietary_restrictions: asStringArray(body.dietaryRestrictions ?? body.dietary_restrictions ?? profile?.dietaryRestrictions),
    display_name: cleanText(body.displayName ?? body.display_name ?? profile?.displayName ?? input.name, 120) || "Jeju explorer",
    food_preferences: asStringArray(body.foodPreferences ?? body.food_preferences ?? profile?.preferredFoods),
    foods_want_to_try: asStringArray(body.foodsWantToTry ?? body.foods_want_to_try ?? profile?.foodWantToTry),
    interested_activities: asStringArray(body.interestedActivities ?? body.interested_activities ?? profile?.preferredActivities),
    program_id: programId,
    restaurants_want_to_visit: asStringArray(body.restaurantsWantToVisit ?? body.restaurants_want_to_visit ?? profile?.placesWantToVisit),
    seafood_preference: enumValue(body.seafoodPreference ?? body.seafood_preference ?? profile?.seafoodPreference, ["avoid", "neutral", "like"] as const, "neutral"),
    spicy_food_tolerance: enumValue(body.spicyFoodTolerance ?? body.spicy_food_tolerance ?? profile?.spicyFoodPreference, ["none", "mild", "medium", "high"] as const, "medium"),
    status: "submitted",
    updated_at: now,
    user_email: input.email
  };
  const existing = await supabaseRequest<JejuProgramApplicationRow[]>(
    `jeju_program_applications?select=${programApplicationColumns}&program_id=eq.${encodeURIComponent(programId)}&user_email=eq.${encodeURIComponent(input.email)}&limit=1`
  );
  const rows = existing[0]
    ? await supabaseRequest<JejuProgramApplicationRow[]>(
        `jeju_program_applications?id=eq.${encodeURIComponent(existing[0].id)}&select=${programApplicationColumns}`,
        { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) }
      )
    : await supabaseRequest<JejuProgramApplicationRow[]>(`jeju_program_applications?select=${programApplicationColumns}`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ ...payload, created_at: now })
      });
  return rows[0] ? toProgramApplication(rows[0]) : null;
}

export async function listJejuProgramApplications(programId: string) {
  const id = safeUuid(programId, "Program identifier");
  const rows = await supabaseRequest<JejuProgramApplicationRow[]>(
    `jeju_program_applications?select=${programApplicationColumns}&program_id=eq.${encodeURIComponent(id)}&order=created_at.desc&limit=1000`
  );
  return rows.map(toProgramApplication);
}

export async function updateJejuProgramApplication(input: { id: unknown; status: unknown; adminNote: unknown }) {
  const id = safeUuid(input.id, "Application identifier");
  const status = enumValue(input.status, ["submitted", "waitlist", "approved", "rejected", "cancelled"] as const, "submitted");
  const rows = await supabaseRequest<JejuProgramApplicationRow[]>(
    `jeju_program_applications?id=eq.${encodeURIComponent(id)}&select=${programApplicationColumns}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        admin_note: cleanText(input.adminNote, 1600),
        status,
        updated_at: new Date().toISOString()
      })
    }
  );
  return rows[0] ? toProgramApplication(rows[0]) : null;
}

export async function getJejuAdminDashboard(email: string) {
  const access = await getJejuAccessForEmail(email);

  if (!access.isAdmin) throw new JejuHttpError("Jeju administrator access is required.", 403, "JEJU_ADMIN_REQUIRED");

  const [places, programs, applicationRows] = await Promise.all([
    listJejuPlaces({ includeInactive: true }),
    listJejuPrograms(email, true),
    supabaseRequest<JejuProgramApplicationRow[]>(
      `jeju_program_applications?select=${programApplicationColumns}&order=created_at.desc&limit=1000`
    )
  ]);

  return {
    access,
    applications: applicationRows.map(toProgramApplication),
    places,
    programs
  };
}

export function toJejuApiError(error: unknown) {
  if (error instanceof JejuHttpError) {
    return { code: error.code, message: error.message, status: error.status };
  }
  if (error instanceof SupabaseRequestError) {
    console.error("Jeju Explorer Supabase request failed", { message: error.message, status: error.status });
    return {
      code: "JEJU_STORAGE_UNAVAILABLE",
      message: "Jeju Explorer storage is temporarily unavailable. Please complete the Jeju database setup.",
      status: error.status === 404 ? 503 : 500
    };
  }
  console.error("Jeju Explorer request failed", error);
  return { code: "JEJU_REQUEST_FAILED", message: "Jeju Explorer is temporarily unavailable.", status: 500 };
}
