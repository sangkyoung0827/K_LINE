import { NextResponse } from "next/server";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { getSupabaseConfig } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const bucket = "woohyukmon-media";
const allowedPrefixes = ["image/", "video/", "audio/", "text/"];
const allowedExactTypes = new Set(["application/pdf"]);

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(-160) || "attachment";
}

export async function POST(request: Request) {
  try {
    const access = await getCurrentEccAccess();
    if (!access.isAdmin) {
      return NextResponse.json({ error: "Admin access is required to upload files for Woohyukmon 3.0." }, { status: 403 });
    }
    const body = (await request.json()) as { files?: Array<{ name?: unknown; type?: unknown }> };
    const files = Array.isArray(body.files) ? body.files.slice(0, 12) : [];
    if (files.length === 0) {
      return NextResponse.json({ error: "Select at least one file." }, { status: 400 });
    }
    const config = getSupabaseConfig();
    const uploads = await Promise.all(
      files.map(async (file, index) => {
        const name = typeof file.name === "string" ? safeName(file.name) : `attachment-${index + 1}`;
        const type = typeof file.type === "string" ? file.type : "application/octet-stream";
        if (!allowedPrefixes.some((prefix) => type.startsWith(prefix)) && !allowedExactTypes.has(type)) {
          throw new Error(`Unsupported file type: ${type || name}`);
        }
        const path = `${access.email.replace(/[^a-zA-Z0-9]/g, "-")}/${Date.now()}-${index}-${name}`;
        const response = await fetch(`${config.url}/storage/v1/object/upload/sign/${bucket}/${path}`, {
          method: "POST",
          headers: {
            apikey: config.serviceRoleKey,
            Authorization: `Bearer ${config.serviceRoleKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const signed = (await response.json()) as { url?: string; signedURL?: string };
        const signedPath = signed.signedURL ?? signed.url;
        if (!signedPath) throw new Error("Signed upload URL was not returned.");
        return {
          name,
          path,
          publicUrl: `${config.url}/storage/v1/object/public/${bucket}/${path}`,
          signedUrl: signedPath.startsWith("http") ? signedPath : `${config.url}/storage/v1${signedPath}`,
          type
        };
      })
    );
    return NextResponse.json({ uploads });
  } catch (error) {
    console.error("Woohyukmon signed upload error", error);
    return NextResponse.json({ error: "File upload preparation failed." }, { status: 500 });
  }
}
