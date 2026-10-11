import { draftFromTemplate } from "./templates";
import { parseGoogleFormDraft } from "./validation";
import { eccNoticeKnowledge, presetNoticeIntroductions } from "./noticeKnowledge";
import type { GoogleFormDraft } from "./types";
import { parseEventDetails, missingEventDetails } from "@/lib/eventStudio/details";

export function presetWithDetails(clubKey: GoogleFormDraft["clubKey"], templateId: string, title: string, raw: unknown) {
  const draft = draftFromTemplate(clubKey, templateId, title);
  const details = parseEventDetails(raw ?? {});
  const missing = missingEventDetails(details);
  const complete = parseGoogleFormDraft({ ...draft, ...details, activityDate: details.activityDate || "", applicationDeadline: details.applicationDeadline || "", location: details.location || "" });
  if (!missing.length) {
    const logistics = `\n\n행사 일시 / Event date: ${details.activityDate}\n장소 / Venue: ${details.location}\n모집 인원 / Participants: ${details.capacity}\n신청 마감 / Application deadline: ${details.applicationDeadline}`;
    complete.description = `${complete.description}${logistics}`;
    const introduction = clubKey === "ecc" ? eccNoticeKnowledge[complete.templateId] || presetNoticeIntroductions[complete.templateId] : presetNoticeIntroductions[complete.templateId];
    if (introduction) { complete.descriptionKo = introduction.ko; complete.descriptionEn = introduction.en; }
  }
  return { draft: complete, details, missing };
}
