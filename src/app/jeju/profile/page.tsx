import type { Metadata } from "next";
import { JejuProfileForm } from "@/components/jeju/JejuProfileForm";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "My Journey Profile",
  description: "Private My Journey food, allergy, activity, and budget preferences.",
  path: "/jeju/profile"
});

export default function JejuProfilePage() {
  return <JejuProfileForm />;
}
