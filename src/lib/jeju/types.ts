export const jejuPlaceCategories = [
  "restaurant",
  "cafe",
  "attraction",
  "hidden_spot",
  "shopping",
  "culture",
  "nature",
  "other"
] as const;

export type JejuPlaceCategory = (typeof jejuPlaceCategories)[number];
export type JejuRole = "user" | "supporter" | "jeju_admin" | "super_admin";
export type JejuPriceRange = "budget" | "moderate" | "premium" | "unknown";

export type JejuPlace = {
  id: string;
  slug: string;
  name: string;
  nameEn: string;
  category: JejuPlaceCategory;
  latitude: number;
  longitude: number;
  address: string;
  description: string;
  descriptionEn: string;
  thumbnailUrl: string;
  thumbnailPath: string;
  averageRating: number;
  reviewCount: number;
  recommendationPercentage: number;
  priceRange: JejuPriceRange;
  atmosphere: string;
  foodFeatures: string[];
  recommendedMenu: string[];
  allergyInfo: string;
  vegetarianSupported: boolean;
  veganSupported: boolean;
  englishFriendly: boolean;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type JejuProfile = {
  userEmail: string;
  displayName: string;
  allergies: string[];
  dietaryRestrictions: string[];
  vegetarian: boolean;
  vegan: boolean;
  spicyFoodPreference: "none" | "mild" | "medium" | "high";
  seafoodPreference: "avoid" | "neutral" | "like";
  budgetPreference: "budget" | "moderate" | "premium";
  preferredFoods: string[];
  preferredActivities: string[];
  placesWantToVisit: string[];
  foodWantToTry: string[];
  updatedAt: string;
};

export type JejuVisit = {
  id: string;
  userEmail: string;
  placeId: string;
  visitedAt: string;
  checkinDistanceMeters: number | null;
  createdAt: string;
};

export type JejuReviewPhoto = {
  id: string;
  reviewId: string;
  publicUrl: string;
  storagePath: string;
};

export type JejuReview = {
  id: string;
  placeId: string;
  visitId: string;
  userEmail: string;
  displayName: string;
  overallRating: number;
  foodRating: number | null;
  priceRating: number;
  atmosphereRating: number;
  whatLiked: string;
  couldBeBetter: string;
  reviewText: string;
  wouldRecommend: boolean;
  isPublic: boolean;
  status: "published" | "hidden";
  createdAt: string;
  updatedAt: string;
  photos: JejuReviewPhoto[];
};

export type JejuMemory = {
  id: string;
  placeId: string;
  visitId: string;
  title: string;
  note: string;
  rating: number | null;
  createdAt: string;
  place: JejuPlace | null;
  photos: JejuReviewPhoto[];
};

export type JejuProgram = {
  id: string;
  slug: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  semester: string;
  capacityMin: number;
  capacityMax: number;
  startsAt: string;
  endsAt: string;
  meetingPlace: string;
  status: "draft" | "open" | "closed" | "completed";
  createdAt: string;
  updatedAt: string;
  applicationCount?: number;
  myApplication?: JejuProgramApplication | null;
};

export type JejuProgramApplication = {
  id: string;
  programId: string;
  userEmail: string;
  displayName: string;
  allergies: string[];
  foodPreferences: string[];
  foodsWantToTry: string[];
  restaurantsWantToVisit: string[];
  attractionsWantToVisit: string[];
  dietaryRestrictions: string[];
  spicyFoodTolerance: string;
  seafoodPreference: string;
  budgetPreference: string;
  interestedActivities: string[];
  status: "submitted" | "waitlist" | "approved" | "rejected" | "cancelled";
  adminNote: string;
  createdAt: string;
  updatedAt: string;
};

export type JejuAccess = {
  email: string;
  role: JejuRole;
  isAdmin: boolean;
  isLoggedIn: boolean;
  isSupporter: boolean;
  isSuperAdmin: boolean;
};

export type JejuExplorerOverview = {
  access: JejuAccess;
  profile: JejuProfile | null;
  places: JejuPlace[];
  visits: JejuVisit[];
  stats: {
    placesExplored: number;
    restaurants: number;
    attractions: number;
    hiddenSpots: number;
  };
};
