import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAdminAccess } from "@/lib/admin";

export async function requirePrivilegedAccess() {
  const session = await auth();
  const access = await getAdminAccess(session?.user?.email ?? "");

  if (!access.isSuperAdmin) {
    redirect("/our-activities");
  }
}
