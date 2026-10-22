export type EventStatus =
  "draft" | "scheduled" | "open" | "closed" | "completed" | "cancelled";
export type Question = {
  id: string;
  title: string;
  type: "text" | "paragraph" | "single" | "multiple";
  required: boolean;
  options: string[];
};
export type EventInput = {
  title: string;
  description: string;
  descriptionEn: string;
  startsAt: string;
  endsAt: string;
  location: string;
  online: boolean;
  capacity: number | null;
  waitlist: boolean;
  approval: "automatic" | "manual";
  applicationsOpenAt: string;
  applicationsCloseAt: string;
  visibility: "public" | "members";
  questions: Question[];
};
export class AppError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export function uuid(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
  )
    throw new AppError("INVALID_ID");
  return value.toLowerCase();
}
function text(value: unknown, max: number, required = false) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new AppError("INVALID_TEXT");
  return value.trim();
}
function date(value: unknown) {
  if (
    typeof value !== "string" ||
    !/T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new AppError("INVALID_DATE_TIMEZONE");
  return new Date(value).toISOString();
}
export function parseQuestions(value: unknown): Question[] {
  if (!Array.isArray(value) || value.length > 15)
    throw new AppError("INVALID_QUESTIONS");
  const ids = new Set<string>();
  return value.map((raw) => {
    if (!raw || typeof raw !== "object") throw new AppError("INVALID_QUESTION");
    const q = raw as Record<string, unknown>;
    const id = text(q.id, 60, true);
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id))
      throw new AppError("INVALID_QUESTION_ID");
    ids.add(id);
    if (
      !["text", "paragraph", "single", "multiple"].includes(String(q.type)) ||
      typeof q.required !== "boolean"
    )
      throw new AppError("INVALID_QUESTION_TYPE");
    const type = q.type as Question["type"];
    if (!Array.isArray(q.options) || q.options.length > 20)
      throw new AppError("INVALID_OPTIONS");
    const options = q.options.map((v) => text(v, 200, true));
    if (
      (type === "single" || type === "multiple") &&
      (options.length < 2 || new Set(options).size !== options.length)
    )
      throw new AppError("INVALID_OPTIONS");
    if ((type === "text" || type === "paragraph") && options.length)
      throw new AppError("INVALID_OPTIONS");
    return {
      id,
      title: text(q.title, 240, true),
      type,
      required: q.required,
      options,
    };
  });
}
export function parseEvent(value: unknown): EventInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AppError("INVALID_EVENT");
  const p = value as Record<string, unknown>;
  const startsAt = date(p.startsAt),
    endsAt = date(p.endsAt);
  const applicationsOpenAt = date(p.applicationsOpenAt),
    applicationsCloseAt = date(p.applicationsCloseAt);
  if (
    endsAt <= startsAt ||
    applicationsCloseAt <= applicationsOpenAt ||
    applicationsCloseAt > endsAt
  )
    throw new AppError("INVALID_DATE_ORDER");
  if (
    p.capacity !== null &&
    (!Number.isInteger(p.capacity) ||
      Number(p.capacity) < 1 ||
      Number(p.capacity) > 10000)
  )
    throw new AppError("INVALID_CAPACITY");
  if (
    typeof p.online !== "boolean" ||
    typeof p.waitlist !== "boolean" ||
    !["automatic", "manual"].includes(String(p.approval)) ||
    !["public", "members"].includes(String(p.visibility))
  )
    throw new AppError("INVALID_EVENT_SETTINGS");
  return {
    title: text(p.title, 180, true),
    description: text(p.description, 12000),
    descriptionEn: text(p.descriptionEn, 12000),
    startsAt,
    endsAt,
    location: text(p.location, 400, true),
    online: p.online,
    capacity: p.capacity as number | null,
    waitlist: p.waitlist,
    approval: p.approval as EventInput["approval"],
    visibility: p.visibility as EventInput["visibility"],
    applicationsOpenAt,
    applicationsCloseAt,
    questions: parseQuestions(p.questions),
  };
}
export function parseAnswers(value: unknown, questions: Question[]) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AppError("INVALID_ANSWERS");
  const input = value as Record<string, unknown>,
    answers: Record<string, string | string[]> = {};
  if (Object.keys(input).some((key) => !questions.some((q) => q.id === key)))
    throw new AppError("UNKNOWN_QUESTION");
  for (const q of questions) {
    const v = input[q.id] ?? (q.type === "multiple" ? [] : "");
    if (q.type === "multiple") {
      if (
        !Array.isArray(v) ||
        v.some((s) => typeof s !== "string" || !q.options.includes(s)) ||
        new Set(v).size !== v.length ||
        (q.required && !v.length)
      )
        throw new AppError("INVALID_ANSWER");
      answers[q.id] = v;
    } else {
      const s = text(v, q.type === "paragraph" ? 2000 : 400, q.required);
      if (q.type === "single" && s && !q.options.includes(s))
        throw new AppError("INVALID_ANSWER");
      answers[q.id] = s;
    }
  }
  return answers;
}
const transitions: Record<EventStatus, EventStatus[]> = {
  draft: ["scheduled", "open", "cancelled"],
  scheduled: ["draft", "open", "cancelled"],
  open: ["closed", "cancelled"],
  closed: ["open", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};
export function canTransition(from: EventStatus, to: EventStatus) {
  return transitions[from]?.includes(to) ?? false;
}
export function canReadMemory(input: {
  viewer: string | null;
  owner: string;
  visibility: string;
  attended: boolean;
  manager: boolean;
  completed: boolean;
  hidden: boolean;
  blocked: boolean;
}) {
  if (input.hidden || input.blocked) return false;
  if (input.viewer === input.owner || input.manager) return true;
  if (!input.completed) return false;
  return (
    input.visibility === "public" ||
    (input.visibility === "participants" && input.attended)
  );
}
export function publicEvent<
  T extends { created_by?: unknown; questions?: unknown },
>(event: T) {
  const { created_by: _createdBy, ...safe } = event;
  return safe;
}
