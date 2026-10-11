import { memberRosterExportResponse } from "@/lib/memberRosterExport";

export const dynamic = "force-dynamic";

export async function GET() {
  return memberRosterExportResponse("hanhwal");
}
