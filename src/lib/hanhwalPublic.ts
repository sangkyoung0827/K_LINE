export type HanhwalChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const hanhwalFacts = {
  name: "Hanhwal (한활)",
  founded: "May 12, 2023",
  instagram: "https://www.instagram.com/jbnu_hanhwal/",
  map: "https://naver.me/xiqZiOei",
  location: "보조구장 (Auxiliary Field), 전북 전주시 덕진구 건지로 20",
  schedule: "Every Saturday, 10:00 AM–12:00 PM",
  mascot: "Solbam (설밤), a leopard",
  newMemberFee: "25,000 KRW",
  returningMemberFee: "20,000 KRW"
} as const;

export const hanhwalSafetyRules = [
  "Wear field-appropriate clothing; shorts, skirts, and slippers are restricted.",
  "Do not enter the practice field while riding a bicycle or electronic kickboard.",
  "Never draw and release a bow without an arrow, and do not lean on a bow.",
  "Never pass in front of an archer who is shooting.",
  "Follow the instructors and collect arrows only after everyone has finished shooting.",
  "Report damaged arrows and return every bow to the correctly numbered cover.",
  "Be patient, cooperate with other members, and clean up after practice."
] as const;

export const hanhwalKnowledge = `HANHWAL PUBLIC CLUB KNOWLEDGE

Hanhwal (한활) was founded on May 12, 2023. It is a Korean traditional archery club for international students and other members interested in Korean archery culture. The community learns, practices, and helps preserve Korean traditional archery (국궁) through safe, disciplined practice.

Weekly practice: ${hanhwalFacts.schedule} at ${hanhwalFacts.location}.
Membership fees: new member ${hanhwalFacts.newMemberFee}; returning member ${hanhwalFacts.returningMemberFee}. Payment and official-member approval are handled through K_LINE's secure Hanhwal registration flow.

Club values: respect for Korean archery tradition, safety, discipline, respect for instructors and senior members, cooperation, community, and proper field etiquette.

Practice topics: Korean traditional bows and arrows, shooting posture and technique, safety, etiquette, terminology, equipment care, and Korean archery culture and history.

Equipment: a gakgung (각궁) is a traditional Korean composite bow. Korean arrows were traditionally made from materials including wood, bamboo, and pheasant feathers. A kkakji (깍지) protects the thumb while drawing and releasing. A gungdae (궁대) is an equipment belt used to carry a bow or arrows. Specific equipment instructions must be confirmed by a Hanhwal instructor.

Safety rules:
${hanhwalSafetyRules.map((rule, index) => `${index + 1}. ${rule}`).join("\n")}

Mascot: ${hanhwalFacts.mascot}. Solbam is Hanhwal's friendly guide.

Privacy and accuracy: never reveal private member, payment, finance, team-chat, or administrator information. Never invent an official rule, schedule, procedure, or club fact. If the answer is not in this public knowledge, say you are unsure and recommend asking an instructor, supervisor, or senior member.`;

export function cleanHanhwalHistory(value: unknown): HanhwalChatMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .reduce<HanhwalChatMessage[]>((messages, entry) => {
      const role = entry.role === "assistant" ? "assistant" : entry.role === "user" ? "user" : null;
      const content = typeof entry.content === "string" ? entry.content.trim().slice(0, 1_000) : "";
      if (role && content) messages.push({ role, content });
      return messages;
    }, [])
    .slice(-8);
}
