import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "Explore",
  description: "This private Explore entry continues on the combined live map and Woohyukmon page.",
  path: "/jeju/map"
});

export default function JejuMapPage() {
  redirect("/jeju");
}
