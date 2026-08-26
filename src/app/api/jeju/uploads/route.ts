import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { jejuAdminDenied, jejuErrorResponse } from "@/lib/jeju/http";
import { getCurrentJejuUser, JejuHttpError } from "@/lib/jeju/service";
import { getSupabaseConfig, SupabaseRequestError } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const maxFileSize = 5 * 1024 * 1024;
const extensions: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

function toPublicObjectUrl(baseUrl: string, path: string) {
  return `${baseUrl}/storage/v1/object/public/jeju-media/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentJejuUser();
    const formData = await request.formData();
    const file = formData.get("file");
    const scope = formData.get("scope") === "places" ? "places" : "reviews";

    if (scope === "places" && !user.access.isAdmin) return jejuAdminDenied(true);
    if (!(file instanceof File)) {
      throw new JejuHttpError("Please select an image file.", 400, "JEJU_IMAGE_REQUIRED");
    }
    if (!extensions[file.type]) {
      throw new JejuHttpError("Only JPEG, PNG, WebP, and GIF images are supported.", 400, "JEJU_IMAGE_TYPE_INVALID");
    }
    if (file.size <= 0 || file.size > maxFileSize) {
      throw new JejuHttpError("Images must be 5 MB or smaller.", 400, "JEJU_IMAGE_SIZE_INVALID");
    }

    const now = new Date();
    const path = `${scope}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${extensions[file.type]}`;
    const config = getSupabaseConfig();
    const response = await fetch(`${config.url}/storage/v1/object/jeju-media/${path.split("/").map(encodeURIComponent).join("/")}`, {
      body: Buffer.from(await file.arrayBuffer()),
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": file.type,
        "x-upsert": "false"
      },
      method: "POST"
    });

    if (!response.ok) {
      throw new SupabaseRequestError(await response.text(), response.status);
    }

    return NextResponse.json({
      publicUrl: toPublicObjectUrl(config.url, path),
      storagePath: path
    }, { status: 201 });
  } catch (error) {
    return jejuErrorResponse(error);
  }
}
