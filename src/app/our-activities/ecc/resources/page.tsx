import type { Metadata } from "next";
import { EccResourceLibrary } from "@/components/EccResourceLibrary";
import { getResourceAccess } from "@/lib/eccResources/server";
import { createPublicMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = createPublicMetadata({
  title: "ECC Resource Library",
  description: "Browse and download public ECC photos, presentations, documents, and shared resources.",
  path: "/our-activities/ecc/resources"
});

export default async function EccResourcesPage() {
  const access = await getResourceAccess();
  return <EccResourceLibrary canUpload={access.canUpload} />;
}
