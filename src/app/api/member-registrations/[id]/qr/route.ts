import QRCode from "qrcode";
import { eccRegistrationConfig } from "@/data/eccRegistration";
import { getMemberRegistrationCampaign } from "@/lib/memberRegistrations";
import { memberRegistrationErrorResponse } from "@/lib/memberRegistrationApi";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const campaign = await getMemberRegistrationCampaign(id);

    if (!campaign) {
      return new Response("Not found", { status: 404 });
    }

    const qrBuffer = await QRCode.toBuffer(eccRegistrationConfig.openChatUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 8,
      type: "png"
    });

    return new Response(new Uint8Array(qrBuffer), {
      headers: {
        "Cache-Control": "public, max-age=300",
        "Content-Disposition": `inline; filename="ecc-open-chat-${id}.png"`,
        "Content-Type": "image/png"
      }
    });
  } catch (error) {
    return memberRegistrationErrorResponse(error);
  }
}
