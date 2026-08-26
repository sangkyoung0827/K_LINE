import type { Metadata } from "next";
import { JejuPlaceDetailClient } from "@/components/jeju/JejuPlaceDetailClient";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "Jeju Explorer Place",
  description: "Private Jeju Explorer place details, check-ins, reviews, and memories.",
  path: "/jeju/place"
});

export default async function JejuPlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JejuPlaceDetailClient placeId={id} />;
}
