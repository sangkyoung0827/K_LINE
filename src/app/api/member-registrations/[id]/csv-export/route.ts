import { toMemberRegistrationCsv } from "@/lib/memberRegistrationCsv";
import { listMemberRegistrationApplicants } from "@/lib/memberRegistrations";
import {
  forbiddenMemberRegistrationResponse,
  memberRegistrationErrorResponse,
  requireMemberRegistrationAdmin
} from "@/lib/memberRegistrationApi";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const adminEmail = await requireMemberRegistrationAdmin();

    if (!adminEmail) {
      return forbiddenMemberRegistrationResponse();
    }

    const { id } = await params;
    const applicants = await listMemberRegistrationApplicants(id);
    const csv = toMemberRegistrationCsv(applicants);

    return new Response(csv, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="member-registration-${id}.csv"`,
        "Content-Type": "text/csv; charset=utf-8"
      }
    });
  } catch (error) {
    return memberRegistrationErrorResponse(error);
  }
}
