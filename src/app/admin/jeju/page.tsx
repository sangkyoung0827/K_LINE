import type { Metadata } from "next";
import { JejuAdminDashboard } from "@/components/jeju/JejuAdminDashboard";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "Explore Administration",
  description: "Private K_LINE Explore administrator workspace.",
  path: "/admin/jeju"
});

export default function JejuAdminPage() {
  return <JejuAdminDashboard />;
}
