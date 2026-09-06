import "server-only";

import { supabaseRequest } from "@/lib/supabaseServer";

type AuditRow = {
  id: string;
  details: Record<string, unknown>;
};

export async function startWoohyukmonAudit(input: {
  actorEmail: string;
  actorOriginalRole: string;
  actionType: string;
  target: string;
  targetType: string;
  targetId: string;
  previousValue: Record<string, unknown>;
  newValue: Record<string, unknown>;
}) {
  const details = {
    source: "woohyukmon",
    actor_original_role: input.actorOriginalRole,
    effective_agent_authority: "super_admin_operations",
    target_type: input.targetType,
    target_id: input.targetId,
    previous_value: input.previousValue,
    new_value: input.newValue,
    status: "pending"
  };

  const rows = await supabaseRequest<AuditRow[]>(
    "woohyukmon_action_audit?select=id,details",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        action_type: input.actionType,
        details,
        target: input.target,
        user_email: input.actorEmail
      })
    }
  );

  if (!rows[0]?.id) {
    throw new Error("Woohyukmon audit log could not be created.");
  }

  return { id: rows[0].id, details };
}

export async function finishWoohyukmonAudit(
  audit: { id: string; details: Record<string, unknown> },
  result: { status: "success" | "failure"; errorMessage?: string }
) {
  await supabaseRequest(
    `woohyukmon_action_audit?id=eq.${encodeURIComponent(audit.id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        details: {
          ...audit.details,
          status: result.status,
          error_message: result.errorMessage || null,
          completed_at: new Date().toISOString()
        }
      })
    }
  );
}
