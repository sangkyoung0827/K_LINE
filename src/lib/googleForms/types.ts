export const googleFormClubKeys = ["ecc", "social_impact_union", "jeju", "general"] as const;
export type GoogleFormClubKey = (typeof googleFormClubKeys)[number];
export type GoogleFormStatus = "draft" | "open" | "closed" | "archived";
export type GoogleQuestionType = "short_answer" | "paragraph" | "multiple_choice" | "checkbox" | "dropdown" | "date" | "time";

export type GoogleFormQuestion = {
  id: string;
  title: string;
  type: GoogleQuestionType;
  required: boolean;
  options: string[];
};

export type GoogleFormDraft = {
  activityDate: string;
  activityId: string;
  activityTitle: string;
  applicationDeadline: string;
  clubKey: GoogleFormClubKey;
  description: string;
  editorEmail: string;
  location: string;
  questions: GoogleFormQuestion[];
  templateId: string;
  title: string;
};

export type GoogleFormRegistryRow = {
  id: string;
  club_key: GoogleFormClubKey;
  activity_id: string | null;
  activity_type: string | null;
  google_form_id: string;
  title: string;
  description: string;
  responder_url: string;
  edit_url: string | null;
  status: GoogleFormStatus;
  application_deadline: string | null;
  response_count: number;
  last_response_sync_at: string | null;
  metadata: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export function isGoogleFormClubKey(value: unknown): value is GoogleFormClubKey {
  return typeof value === "string" && googleFormClubKeys.includes(value as GoogleFormClubKey);
}
