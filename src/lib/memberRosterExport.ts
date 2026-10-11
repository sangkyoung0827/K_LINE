import "server-only";

import { getCurrentEccAccess } from "@/lib/eccAccess";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import { eccMemberRegistrationsTable } from "@/lib/eccMemberRegistrations";
import { hanhwalMemberRegistrationsTable } from "@/lib/hanhwalMemberRegistrations";
import { createMemberRosterWorkbook, memberRosterMimeType, type MemberRosterEntry } from "@/lib/memberRoster";
import { supabaseRequest } from "@/lib/supabaseServer";

const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
type RosterRow = { id: string; student_id: string | null; full_name: string | null };

export async function memberRosterExportResponse(club: "ecc" | "hanhwal") {
  try {
    const access = club === "ecc" ? await getCurrentEccAccess() : await getCurrentHanhwalAccess();
    if (!access.isAdmin) {
      return Response.json({ error: "Admin access is required." }, { status: access.isLoggedIn ? 403 : 401, headers: privateHeaders });
    }
    const table = club === "ecc" ? eccMemberRegistrationsTable : hanhwalMemberRegistrationsTable;
    const entries: MemberRosterEntry[] = [];
    let cursor = "";
    // Keyset pagination avoids the existing management list's 1,000-row limit.
    for (;;) {
      const rows = await supabaseRequest<RosterRow[]>(`${table}?select=id,student_id,full_name&order=id.asc&limit=500${cursor ? `&id=gt.${encodeURIComponent(cursor)}` : ""}`);
      if (!rows.length) break;
      entries.push(...rows.map((row) => ({ studentId: row.student_id ?? "", fullName: row.full_name ?? "" })));
      const nextCursor = rows[rows.length - 1].id;
      if (!nextCursor || nextCursor === cursor) throw new Error("Roster pagination did not advance.");
      cursor = nextCursor;
    }
    const bytes = await createMemberRosterWorkbook(entries);
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...privateHeaders,
        "Content-Type": memberRosterMimeType,
        "Content-Disposition": `attachment; filename="${club}-members-${new Date().toISOString().slice(0, 10)}.xlsx"`
      }
    });
  } catch {
    return Response.json({ error: "Member roster export is temporarily unavailable." }, { status: 503, headers: privateHeaders });
  }
}
