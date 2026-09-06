export type WoohyukmonOperationTool =
  | "mark_payment_confirmed"
  | "mark_payment_unconfirmed"
  | "approve_official_member"
  | "revoke_official_member"
  | "append_member_admin_note"
  | "open_activity_applications"
  | "close_activity_applications";

export type WoohyukmonMemberCandidate = {
  id: string;
  name: string;
  departmentOrMajor: string;
  nationality: string;
  paymentConfirmed: boolean;
  officialMember: boolean;
};

export type WoohyukmonTableRow = Record<string, string | number | boolean | null>;

export type WoohyukmonOperationResponse =
  | {
      handled: false;
    }
  | {
      handled: true;
      kind: "answer";
      title: string;
      summary?: string;
      rows?: WoohyukmonTableRow[];
      contextTargetId?: string;
      contextTargetIds?: string[];
    }
  | {
      handled: true;
      kind: "candidates";
      title: string;
      summary: string;
      candidates: WoohyukmonMemberCandidate[];
    }
  | {
      handled: true;
      kind: "confirmation";
      title: string;
      summary: string;
      token: string;
      tool: WoohyukmonOperationTool;
      targetCount: number;
      rows?: WoohyukmonTableRow[];
    }
  | {
      handled: true;
      kind: "result";
      title: string;
      summary: string;
      succeeded: number;
      failed: number;
      rows?: WoohyukmonTableRow[];
      contextTargetId?: string;
      contextTargetIds?: string[];
    };

export type WoohyukmonConfirmationPayload = {
  version: 1;
  actorEmail: string;
  actorRole: string;
  tool: WoohyukmonOperationTool;
  targetIds: string[];
  expected: Array<{
    id: string;
    paymentConfirmed?: boolean;
    officialMember?: boolean;
    status?: string;
    updatedAt?: string;
    activityOpen?: boolean;
  }>;
  args: {
    note?: string;
    activityId?: string;
  };
  expiresAt: number;
};
