import type { Metadata } from "next";
import { JejuDiscover } from "@/components/jeju/JejuDiscover";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "Discover Jeju",
  description: "Private K_LINE Jeju Explorer place discovery for signed-in users.",
  path: "/jeju/discover"
});

export default function JejuDiscoverPage() {
  return <JejuDiscover />;
}
