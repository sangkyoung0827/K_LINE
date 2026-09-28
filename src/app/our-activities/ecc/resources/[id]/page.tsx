import type { Metadata } from "next";
import { EccResourceDetail } from "@/components/EccResourceDetail";
import { getResourceAccess } from "@/lib/eccResources/server";
import { createNoIndexMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = createNoIndexMetadata({
  title: "ECC Resource",
  description: "View and download an ECC shared file.",
  path: "/our-activities/ecc/resources"
});

export default async function EccResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, access] = await Promise.all([params, getResourceAccess()]);
  return <EccResourceDetail id={id} isAdmin={access.isAdmin} />;
}
