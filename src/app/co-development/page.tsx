import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { canUseCoDevelopment } from "@/lib/coDevelopment/model";
import { CoDevelopmentWorkspace } from "@/components/co-development/CoDevelopmentWorkspace";
import { createNoIndexMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = createNoIndexMetadata({ title: "Co-development | K_LINE", description: "Private co-developer workspace", path: "/co-development" });

export default async function CoDevelopmentPage() {
  const session = await auth();
  if (!canUseCoDevelopment(session?.user?.email)) notFound();
  return <CoDevelopmentWorkspace />;
}
