import { GlobalWoohyukmon } from "@/components/GlobalWoohyukmon";
import { getCurrentEccAccess } from "@/lib/eccAccess";

export async function GlobalWoohyukmonGate() {
  const access = await getCurrentEccAccess();

  if (!access.isAdmin) {
    return null;
  }

  return <GlobalWoohyukmon actorRole={access.role} />;
}
