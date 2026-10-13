import { getClubAssistantAccess } from "@/lib/woohyukmon/club-access";
import { ClubAssistantError, invokeClubCapability, verifyClubApproval } from "@/lib/woohyukmon/club-service";
import { createClubDocument, documentRows } from "@/lib/woohyukmon/club-documents";
import { createMemberRosterWorkbook, memberRosterMimeType } from "@/lib/memberRoster";

export const dynamic = "force-dynamic";
export const maxDuration = 180;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
export async function GET(request: Request) {
  try {
    const access = await getClubAssistantAccess();
    const approval = verifyClubApproval(new URL(request.url).searchParams.get("token") || "", access, "club-export");
    if (approval.call.method !== "GET" || !["xlsx", "docx"].includes(approval.format || "")) throw new ClubAssistantError("Invalid export.");
    const data = await invokeClubCapability(access, approval.call, request);
    if (approval.format === "xlsx" && ["ecc_members", "hanhwal_members"].includes(approval.call.capability)) {
      const bytes = await createMemberRosterWorkbook(data.registrations.map((row: { studentId: string; fullName: string }) => ({ studentId: row.studentId, fullName: row.fullName })));
      return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": memberRosterMimeType, "Content-Disposition": `attachment; filename="K_LINE-${approval.call.capability}.xlsx"` } });
    }
    const document = await createClubDocument(approval.format!, approval.title, documentRows(data));
    return new Response(document.bytes, { headers: { ...headers, "Content-Type": document.mime, "Content-Disposition": `attachment; filename="K_LINE-${approval.call.capability}.${approval.format}"` } });
  } catch (error) { return Response.json({ error: error instanceof ClubAssistantError ? error.message : "문서를 생성하지 못했습니다." }, { status: error instanceof ClubAssistantError ? error.status : 503, headers }); }
}
