export const defaultHanhwalActivityCatalog = [
  ["gathering", "정기 국궁 연습", "Regular Archery Practice"],
  ["mt", "한활 수련회", "Hanhwal Training Camp"],
  ["special", "전통 국궁 행사", "Traditional Archery Event"],
  ["opening", "개강 연습", "Semester Opening Practice"],
  ["farewell", "종강 연습", "Semester Closing Practice"],
  ["english-class", "국궁 입문 수업", "Beginner Archery Class"]
].map(([id, titleKo, titleEn], index) => ({
  id,
  titleKo: `${titleKo} 신청`,
  titleEn: `${titleEn} Application`,
  descriptionKo: `한활 ${titleKo} 참여 신청`,
  descriptionEn: `Apply for ${titleEn}`,
  archived: false,
  sortOrder: (index + 1) * 10
}));
