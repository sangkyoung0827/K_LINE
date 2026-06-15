import { NextResponse } from "next/server";
import {
  applicantStatusColumns,
  applicantStatusTable,
  listMemberRegistrationApplicants,
  normalizeApplicantStatus
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

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const adminEmail = await requireMemberRegistrationAdmin();

    if (!adminEmail) {
      return forbiddenMemberRegistrationResponse();
    }

    const { id } = await params;
    const body = (await request.json()) as {
      applicants?: Array<{
        id?: string;
        status?: string;
        kakaoJoined?: boolean;
        memo?: string;
      }>;
    };
    const updates = Array.isArray(body.applicants) ? body.applicants : [];

    await Promise.all(
      updates
        .map((applicant) => ({
          id: cleanText(applicant.id, 120),
          status: normalizeApplicantStatus(applicant.status),
          kakaoJoined: Boolean(applicant.kakaoJoined),
          memo: cleanText(applicant.memo, 1200)
        }))
        .filter((applicant) => applicant.id)
        .map((applicant) =>
          supabaseRequest(
            `${applicantStatusTable}?id=eq.${encodeURIComponent(
              applicant.id
            )}&campaign_id=eq.${encodeURIComponent(id)}&select=${applicantStatusColumns}`,
            {
              method: "PATCH",
              headers: {
                Prefer: "return=representation"
              },
              body: JSON.stringify({
                kakao_joined: applicant.kakaoJoined,
                memo: applicant.memo,
                status: applicant.status,
                updated_at: new Date().toISOString(),
                updated_by: adminEmail
              })
            }
          )
        )
    );

    const applicants = await listMemberRegistrationApplicants(id);
    return NextResponse.json({ applicants });
  } catch (error) {
    return memberRegistrationErrorResponse(error);
  }
}
