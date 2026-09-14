import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MyHistory } from "@/components/MyHistory";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "My history", description: "Your private club activity records.", path: "/my-history"
});

export default async function MyHistoryPage() {
  if (!(await auth())?.user?.email) redirect("/login?callbackUrl=%2Fmy-history");
  return <MyHistory />;
}
