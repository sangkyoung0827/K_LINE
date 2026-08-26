import type { Metadata } from "next";
import { JejuMapPageClient } from "@/components/jeju/JejuMapPageClient";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "My Jeju Map",
  description: "Private Jeju Explorer visited-place map for signed-in K_LINE users.",
  path: "/jeju/map"
});

export default function JejuMapPage() {
  return <JejuMapPageClient />;
}
