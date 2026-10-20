import type { StudioPreview } from "@/components/google-forms/EventStudio";

type Command = <T>(body: object) => Promise<T>;
export type CreationStep = "planning" | "saving" | "connecting" | "creating";

// Called only from an explicit create action, never when browsing saved events.
export async function completeEventFlow(preview: StudioPreview, command: Command, step: (value: CreationStep) => void) {
  if (preview.job.state === "notice_saved" || preview.missing.length || !preview.creationSupported) return { preview, needsConnection: false };
  if (preview.job.state === "running") throw new Error("JOB_RUNNING_WAIT");
  if (preview.job.club_key === "personal") {
    step("connecting");
    const status = await command<{ connected: boolean }>({ action: "connection" });
    if (!status.connected) return { preview, needsConnection: true };
  }
  step("creating");
  const reviewed = await command<StudioPreview>({ action: "review", jobId: preview.job.id });
  if (reviewed.job.revision !== preview.job.revision) throw new Error("JOB_CHANGED_REVIEW_AGAIN");
  if (!reviewed.token || reviewed.missing.length) return { preview: reviewed, needsConnection: false };
  const created = await command<StudioPreview>({ action: "approve", jobId: reviewed.job.id, revision: reviewed.job.revision, token: reviewed.token, confirmed: true });
  return { preview: created, needsConnection: false };
}

export const creationIntentKey = "kline.event-studio.creation";
export function matchingCreationIntent(raw: string | null, jobId: string, revision: number, now = Date.now()) {
  try {
    const intent = JSON.parse(raw || "null");
    return intent?.jobId === jobId && intent.revision === revision && Number.isFinite(intent.expires) && intent.expires > now;
  } catch { return false; }
}
