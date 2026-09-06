export function normalizeNationality(raw: string) {
  const compact = raw.normalize("NFKC").trim().toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");

  const aliases: Array<[RegExp, string]> = [
    [/^(대한민국|한국|대한민국 국적|korea|south korea|republic of korea|korean)$/i, "South Korea"],
    [/^(kazakh|kazakhstan|kazakhtstan|kazakhstani)$/i, "Kazakhstan"],
    [/^(russia|russian|러시아|russian federation)$/i, "Russia"],
    [/^(malaysia|malaysian)$/i, "Malaysia"],
    [/^(moldova|moldovan|republic of moldova)$/i, "Moldova"],
    [/^(china|chinese|중국|prc)$/i, "China"],
    [/^(japan|japanese|일본)$/i, "Japan"],
    [/^(vietnam|vietnamese|베트남)$/i, "Vietnam"],
    [/^(mongolia|mongolian|몽골)$/i, "Mongolia"],
    [/^(uzbekistan|uzbek|uzbekistani)$/i, "Uzbekistan"],
    [/^(kyrgyzstan|kyrgyz|kyrgyzstani)$/i, "Kyrgyzstan"]
  ];

  for (const [pattern, canonical] of aliases) {
    if (pattern.test(compact)) return canonical;
  }

  return raw.trim() || "Unknown";
}

export function isKoreanNationality(raw: string) {
  return normalizeNationality(raw) === "South Korea";
}

export function normalizeGender(raw: string) {
  const value = raw.normalize("NFKC").trim().toLowerCase();

  if (/^(male|man|m|남성|남자)$/.test(value)) return "Male";
  if (/^(female|woman|f|여성|여자)$/.test(value)) return "Female";
  if (/prefer|밝히고 싶지|비공개/.test(value)) return "Prefer not to say";
  return raw.trim() || "Other";
}
