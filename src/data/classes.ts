import type { ClassItem } from "@/types";

export const classes: ClassItem[] = [
  {
    id: "one-day-archery",
    slug: "one-day-korean-archery-experience",
    title: "One-day Korean Archery Experience",
    koreanTitle: "원데이 국궁 체험",
    description:
      "A first encounter with Korean traditional archery, safety, posture, and the cultural meaning of the bow.",
    targetParticipants: ["Foreign visitors", "International students", "Korean students"],
    durationPlaceholder: "Approx. 90-120 minutes",
    pricePlaceholder: "Inquiry-based price",
    includedItems: ["Safety briefing", "Basic posture", "Guided shooting practice", "Culture explanation"]
  },
  {
    id: "beginner-archery",
    slug: "beginner-archery-class",
    title: "Beginner Archery Class",
    koreanTitle: "초급 국궁 수업",
    description:
      "A structured beginner class for students and visitors who want to train posture, focus, and repeatable form.",
    targetParticipants: ["Korean students", "International students", "Cultural learners"],
    durationPlaceholder: "Multi-session schedule by inquiry",
    pricePlaceholder: "Inquiry-based price",
    includedItems: ["Safety rules", "Traditional bow posture", "Form correction", "Practice routine"]
  },
  {
    id: "group-culture",
    slug: "group-cultural-experience-program",
    title: "Group Cultural Experience Program",
    koreanTitle: "단체 문화 체험 프로그램",
    description:
      "A group program connecting Korean archery, body-mind training, and traditional martial culture.",
    targetParticipants: ["Cultural experience groups", "Schools", "Institutions"],
    durationPlaceholder: "Flexible group schedule",
    pricePlaceholder: "Group inquiry price",
    includedItems: ["Group orientation", "Archery culture talk", "Guided practice", "Optional martial culture explanation"]
  },
  {
    id: "international-student",
    slug: "international-student-program",
    title: "International Student Program",
    koreanTitle: "유학생 국궁 프로그램",
    description:
      "A cultural bridge program for international students to experience Korean discipline, focus, and community.",
    targetParticipants: ["International students", "Exchange students", "University groups"],
    durationPlaceholder: "By semester, workshop, or one-day inquiry",
    pricePlaceholder: "Inquiry-based price",
    includedItems: ["Bilingual orientation", "Korean archery basics", "Cultural meaning", "Community activity"]
  }
];
