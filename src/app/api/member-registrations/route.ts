import { NextResponse } from "next/server";
import {
  createMemberRegistrationCampaign,
  listMemberRegistrationCampaigns,
  normalizeCampaignInput,
  validateCampaignPayload
} from "@/lib/memberRegistrations";
import {
  forbiddenMemberRegistrationResponse,
  memberRegistrationErrorResponse,
  requireMemberRegistrationAdmin
} from "@/lib/memberRegistrationApi";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const adminEmail = await requireMemberRegistrationAdmin();

    if (!adminEmail) {
      return forbiddenMemberRegistrationResponse();
    }

    const campaigns = await listMemberRegistrationCampaigns();
    return NextResponse.json({ campaigns });
  } catch (error) {
    return memberRegistrationErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const adminEmail = await requireMemberRegistrationAdmin();

    if (!adminEmail) {
      return forbiddenMemberRegistrationResponse();
    }

    const body = (await request.json()) as Record<string, unknown>;
    const payload = normalizeCampaignInput(body);
    const validationError = validateCampaignPayload(payload);

    if (validationError) {
      return NextResponse.json(
        { error: validationError, debugCode: "MEMBER_REGISTRATION_VALIDATION_FAILED" },
        { status: 400 }
      );
    }

    const campaign = await createMemberRegistrationCampaign(payload, adminEmail);
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    return memberRegistrationErrorResponse(error);
  }
}
