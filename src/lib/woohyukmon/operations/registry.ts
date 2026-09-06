import type { WoohyukmonOperationTool } from "@/lib/woohyukmon/operations/types";

export const woohyukmonToolRegistry = {
  find_ecc_member: { category: "MEMBERS", write: false },
  get_ecc_member: { category: "MEMBERS", write: false },
  list_ecc_members: { category: "MEMBERS", write: false },
  list_paid_members: { category: "PAYMENTS", write: false },
  list_unpaid_members: { category: "PAYMENTS", write: false },
  list_pending_members: { category: "MEMBERSHIP", write: false },
  get_official_members: { category: "MEMBERSHIP", write: false },
  get_member_statistics: { category: "STATISTICS", write: false },
  get_payment_statistics: { category: "STATISTICS", write: false },
  get_nationality_statistics: { category: "STATISTICS", write: false },
  get_gender_statistics: { category: "STATISTICS", write: false },
  list_activity_applicants: { category: "ACTIVITIES", write: false },
  get_activity_statistics: { category: "ACTIVITIES", write: false },
  list_open_activities: { category: "ACTIVITIES", write: false },
  mark_payment_confirmed: { category: "PAYMENTS", write: true },
  mark_payment_unconfirmed: { category: "PAYMENTS", write: true },
  approve_official_member: { category: "MEMBERSHIP", write: true },
  revoke_official_member: { category: "MEMBERSHIP", write: true },
  append_member_admin_note: { category: "ADMINISTRATION", write: true },
  open_activity_applications: { category: "ACTIVITIES", write: true },
  close_activity_applications: { category: "ACTIVITIES", write: true }
} as const;

export type WoohyukmonRegisteredTool = keyof typeof woohyukmonToolRegistry;

export function isRegisteredWriteTool(
  value: string
): value is WoohyukmonOperationTool {
  const tool = woohyukmonToolRegistry[value as WoohyukmonRegisteredTool];
  return Boolean(tool?.write);
}
