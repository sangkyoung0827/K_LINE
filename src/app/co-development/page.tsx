import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canUseCoDevelopment, isLabOwner } from "@/lib/coDevelopment/model";
import { CoDevelopmentWorkspace } from "@/components/co-development/CoDevelopmentWorkspace";
import { createNoIndexMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = createNoIndexMetadata({ title: "Co-development | K_LINE", description: "Account-scoped Developer Studio", path: "/co-development" });

export default async function CoDevelopmentPage() {
  const session = await auth();
  if (!canUseCoDevelopment(session?.user?.email)) redirect("/login?callbackUrl=%2Fco-development");
  return <CoDevelopmentWorkspace owner={isLabOwner(session?.user?.email)} />;
}
