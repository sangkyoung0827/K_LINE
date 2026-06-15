import QRCode from "qrcode";
import { eccRegistrationConfig } from "@/data/eccRegistration";

export const dynamic = "force-dynamic";

export async function GET() {
  const qrBuffer = await QRCode.toBuffer(eccRegistrationConfig.openChatUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 8,
    type: "png"
  });

  return new Response(new Uint8Array(qrBuffer), {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Disposition": 'inline; filename="ecc-open-chat-qr.png"',
      "Content-Type": "image/png"
    }
  });
}
