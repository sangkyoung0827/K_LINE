import { NextResponse } from "next/server";
import {
  getMemberRegistrationCampaign,
  listMemberRegistrationApplicants,
  normalizeCampaignInput,
  updateMemberRegistrationCampaign,
  validateCampaignPayload
} from "@/lib/memberRegistrations";
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
    const campaign = await getMemberRegistrationCampaign(id);

    if (!campaign) {
      return NextResponse.json(
        {
          error: "Member registration campaign was not found.",
          debugCode: "MEMBER_REGISTRATION_NOT_FOUND"
        },
        { status: 404 }
      );
    }

    const applicants = await listMemberRegistrationApplicants(id);
    return NextResponse.json({ applicants, campaign });
  } catch (error) {
    return memberRegistrationErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const adminEmail = await requireMemberRegistrationAdmin();

    if (!adminEmail) {
      return forbiddenMemberRegistrationResponse();
    }

    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const payload = normalizeCampaignInput(body);
    const validationError = validateCampaignPayload(payload);

    if (validationError) {
      return NextResponse.json(
        { error: validationError, debugCode: "MEMBER_REGISTRATION_VALIDATION_FAILED" },
        { status: 400 }
      );
    }

    const campaign = await updateMemberRegistrationCampaign(id, payload);

    if (!campaign) {
      return NextResponse.json(
        {
          error: "Member registration campaign was not found.",
          debugCode: "MEMBER_REGISTRATION_NOT_FOUND"
        },
        { status: 404 }
      );
    }

    const applicants = await listMemberRegistrationApplicants(id);
    return NextResponse.json({ applicants, campaign });
  } catch (error) {
    return memberRegistrationErrorResponse(error);
  }
}
