import QRCode from "qrcode";
import { getEccOperationalSettings } from "@/lib/eccOperations";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getEccOperationalSettings();
  const qrBuffer = await QRCode.toBuffer(settings.newMemberOpenChatUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 8,
    type: "png"
  });

  return new Response(new Uint8Array(qrBuffer), {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=60",
      "Content-Disposition": 'inline; filename="ecc-open-chat-qr.png"',
      "Content-Type": "image/png"
    }
  });
}
