export type EventDetails = {
  activityDate: string | null;
  applicationDeadline: string | null;
  location: string | null;
  capacity: number | null;
};
export const eventDetailOrder = ["activityDate", "capacity", "location", "applicationDeadline"] as const;
export type EventDetailField = typeof eventDetailOrder[number];
export const emptyEventDetails: EventDetails = { activityDate: null, applicationDeadline: null, location: null, capacity: null };
export class EventDetailsError extends Error {}

export function parseEventDetails(value: unknown): EventDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new EventDetailsError("INVALID_EVENT_DETAILS");
  const raw = value as Record<string, unknown>;
  const details = { ...emptyEventDetails };
  for (const field of ["activityDate", "applicationDeadline"] as const) {
    const date = raw[field];
    if (date === undefined || date === null || date === "") continue;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date.slice(0, 10) + "T00:00:00Z").toISOString().slice(0, 10) !== date.slice(0, 10)) throw new EventDetailsError("INVALID_EVENT_DATE");
    details[field] = date;
  }
  if (raw.capacity !== undefined && raw.capacity !== null && raw.capacity !== "") {
    if (typeof raw.capacity !== "number" || !Number.isInteger(raw.capacity) || raw.capacity < 1 || raw.capacity > 100000) throw new EventDetailsError("INVALID_CAPACITY");
    details.capacity = raw.capacity;
  }
  if (raw.location !== undefined && raw.location !== null && raw.location !== "") {
    if (typeof raw.location !== "string" || !raw.location.trim() || raw.location.length > 300) throw new EventDetailsError("INVALID_EVENT_LOCATION");
    details.location = raw.location.trim();
  }
  if (details.activityDate && details.applicationDeadline && Date.parse(details.applicationDeadline) > Date.parse(details.activityDate)) throw new EventDetailsError("DEADLINE_AFTER_ACTIVITY");
  return details;
}
export function missingEventDetails(details: EventDetails): EventDetailField[] {
  return eventDetailOrder.filter(field => details[field] === null);
}
export function eventDetailQuestion(field: EventDetailField, title: string, ko: boolean) {
  const questions = {
    activityDate: [title ? `“${title}”는 언제 진행할까요?` : "행사는 언제 진행할까요?", title ? `When would you like to hold “${title}”?` : "When would you like to hold the event?"],
    capacity: ["몇 명을 모집할까요?", "How many participants would you like to recruit?"],
    location: ["어디에서 진행할까요? 장소를 알려주세요.", "Where will it take place?"],
    applicationDeadline: ["신청은 언제까지 받을까요?", "When should applications close?"],
  };
  return questions[field][ko ? 0 : 1];
}
