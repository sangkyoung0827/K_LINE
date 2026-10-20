import type { Metadata } from "next";
import { ClubResourceLibrary } from "@/components/club-resources/ClubResourceLibrary";
import { HanhwalPublicShell } from "@/components/HanhwalPublicShell";
import { getHanhwalResourceAccess } from "@/lib/hanhwalResources/server";
import { createPublicMetadata } from "@/lib/seo";
import "./resources.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = createPublicMetadata({
  title: "Hanhwal Resource Library", description: "Hanhwal archery training, research, photos and event materials.",
  path: "/our-activities/hanhwal/resources"
});
export default async function ResourcesPage() {
  const access = await getHanhwalResourceAccess();
  return <HanhwalPublicShell><ClubResourceLibrary club="hanhwal" canUpload={access.canUpload}/></HanhwalPublicShell>;
}
