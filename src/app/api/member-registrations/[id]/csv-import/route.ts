import { NextResponse } from "next/server";
import { parseMemberRegistrationCsv } from "@/lib/memberRegistrationCsv";
import {
  applicantStatusColumns,
  applicantStatusTable,
  listMemberRegistrationApplicants
} from "@/lib/memberRegistrations";
import {
  forbiddenMemberRegistrationResponse,
  memberRegistrationErrorResponse,
  requireMemberRegistrationAdmin
} from "@/lib/memberRegistrationApi";
import { cleanText, supabaseRequest } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const adminEmail = await requireMemberRegistrationAdmin();

    if (!adminEmail) {
      return forbiddenMemberRegistrationResponse();
    }

    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const csvText = cleanText(body.csvText, 200000);
    const parsedRows = parseMemberRegistrationCsv(csvText);

    if (parsedRows.length === 0) {
      return NextResponse.json(
        {
          error: "No applicant rows were found in the pasted CSV.",
          debugCode: "MEMBER_REGISTRATION_CSV_EMPTY"
        },
        { status: 400 }
      );
    }

    const existingApplicants = await listMemberRegistrationApplicants(id);
    const existingRowIds = new Set(existingApplicants.map((applicant) => applicant.externalRowId));
    const newRows = parsedRows.filter((row) => !existingRowIds.has(row.externalRowId));

    if (newRows.length > 0) {
      await supabaseRequest(
        `${applicantStatusTable}?select=${applicantStatusColumns}`,
        {
          method: "POST",
          headers: {
            Prefer: "return=representation"
          },
          body: JSON.stringify(
            newRows.map((row) => ({
              applicant_email: row.applicantEmail,
              applicant_name: row.applicantName,
              campaign_id: id,
              external_row_id: row.externalRowId,
              kakao_joined: false,
              memo: "",
              status: "pending",
              updated_at: new Date().toISOString(),
              updated_by: adminEmail
            }))
          )
        }
      );
    }

    const applicants = await listMemberRegistrationApplicants(id);
    return NextResponse.json({
      applicants,
      importedCount: newRows.length,
      skippedCount: parsedRows.length - newRows.length
    });
  } catch (error) {
    return memberRegistrationErrorResponse(error);
  }
}
