export const activityPreferenceTaxonomy = [
  { id: "social_networking", labelEn: "Social & Networking", labelKo: "소셜 · 네트워킹", description: "Meeting people and exchanging experiences." },
  { id: "party_nightlife", labelEn: "Party & Nightlife", labelKo: "파티 · 나이트라이프", description: "Explicitly described parties and nightlife activities." },
  { id: "culture_tradition", labelEn: "Culture & Tradition", labelKo: "문화 · 전통", description: "Experiencing cultural practices and traditions." },
  { id: "travel", labelEn: "Travel", labelKo: "여행", description: "Trips and travel activities." },
  { id: "food", labelEn: "Food", labelKo: "음식", description: "Food-focused experiences." },
  { id: "outdoor", labelEn: "Outdoors", labelKo: "야외 활동", description: "Activities explicitly held outdoors." },
  { id: "sports", labelEn: "Sports", labelKo: "스포츠", description: "Sport practice and games." },
  { id: "wellness", labelEn: "Wellness", labelKo: "웰니스", description: "Relaxation and wellbeing activities, not health conditions." },
  { id: "volunteering", labelEn: "Volunteering", labelKo: "봉사", description: "Voluntary community service." },
  { id: "education", labelEn: "Education", labelKo: "교육", description: "Classes and learning activities." },
  { id: "career", labelEn: "Career", labelKo: "진로", description: "Career exploration activities." },
  { id: "creative", labelEn: "Creative", labelKo: "창작", description: "Arts and making activities." },
  { id: "language_exchange", labelEn: "Language Exchange", labelKo: "언어 교류", description: "Explicit language learning or exchange activities." },
  { id: "local_exploration", labelEn: "Local Exploration", labelKo: "지역 탐방", description: "Exploring local places." }
] as const;

export type PreferenceCategory = typeof activityPreferenceTaxonomy[number]["id"];
export const preferenceCategoryIds = new Set<string>(activityPreferenceTaxonomy.map((item) => item.id));
