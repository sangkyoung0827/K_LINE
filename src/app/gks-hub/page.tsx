import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGksHubAccess } from "@/lib/gksHub/access";
import { GksHub } from "@/components/gks-hub/GksHub";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const access = await getGksHubAccess();
  return {
    ...(access.allowed ? { title: "GKS Hub" } : {}),
    robots: { index: false, follow: false, nocache: true }
  };
}

export default async function GksHubPage() {
  const access = await getGksHubAccess();
  if (!access.allowed) notFound();
  return <GksHub actorEmail={access.email} draftKey={access.draftKey} />;
}
