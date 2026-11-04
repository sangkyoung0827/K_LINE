import { randomUUID } from "node:crypto";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  accessibleMemory,
  appDB,
  dbConfig,
  getActor,
  requireWrite,
} from "@/lib/woohyukmonApp/server";
import { AppError, uuid } from "@/lib/woohyukmonApp/model";
import { errorResponse, respond } from "@/lib/woohyukmonApp/http";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const bucket = "woohyukmon-event-media";
async function storage(path: string, init: RequestInit = {}) {
  const config = dbConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", config.serviceRoleKey);
  headers.set("Authorization", `Bearer ${config.serviceRoleKey}`);
  const response = await fetch(`${config.url}/storage/v1/${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (!response.ok) throw new AppError("PHOTO_STORAGE_UNAVAILABLE", 503);
  return response;
}
export async function OPTIONS(request: Request) {
  return respond(request, {});
}
export async function GET(request: Request) {
  try {
    const actor = await getActor(request, false),
      memory = await accessibleMemory(
        uuid(new URL(request.url).searchParams.get("memoryId")),
        actor,
      );
    const assets = await appDB<{ id: string; storage_path: string }[]>(
      `woo_v1_memory_assets?memory_id=eq.${memory.id}&select=id,storage_path&limit=50`,
    );
    const photos = [];
    for (const asset of assets) {
      const response = await storage(
        `object/sign/${bucket}/${asset.storage_path}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiresIn: 60 }),
        },
      );
      const payload = await response.json();
      if (typeof payload.signedURL !== "string")
        throw new AppError("PHOTO_STORAGE_UNAVAILABLE", 503);
      photos.push({
        id: asset.id,
        url: `${dbConfig().url}/storage/v1${payload.signedURL}`,
      });
    }
    return respond(request, { photos, expiresIn: 60 });
  } catch (error) {
    return errorResponse(request, error);
  }
}
export async function POST(request: Request) {
  try {
    const actor = (await getActor(request))!;
    requireWrite(actor, request);
    if (Number(request.headers.get("content-length") || 0) > 6 * 1024 * 1024)
      throw new AppError("PHOTO_TOO_LARGE", 413);
    const form = await request.formData(),
      file = form.get("file"),
      memory = await accessibleMemory(uuid(form.get("memoryId")), actor);
    if (memory.owner_id !== actor.id) throw new AppError("FORBIDDEN", 403);
    if (
      !(file instanceof File) ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size < 1 ||
      file.size > 5 * 1024 * 1024
    )
      throw new AppError("INVALID_PHOTO");
    if (form.get("consent") !== "true")
      throw new AppError("PHOTO_CONSENT_REQUIRED");
    const current = await appDB<unknown[]>(
      `woo_v1_memory_assets?memory_id=eq.${memory.id}&select=id&limit=50`,
    );
    if (current.length >= 50) throw new AppError("PHOTO_LIMIT");
    // Decode and re-encode to remove EXIF/location metadata and reject executable payloads.
    const image = await loadImage(Buffer.from(await file.arrayBuffer()));
    if (
      image.width < 1 ||
      image.height < 1 ||
      image.width * image.height > 40000000
    )
      throw new AppError("INVALID_PHOTO_DIMENSIONS");
    const ratio = Math.min(1, 2048 / Math.max(image.width, image.height)),
      canvas = createCanvas(
        Math.max(1, Math.round(image.width * ratio)),
        Math.max(1, Math.round(image.height * ratio)),
      );
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    const bytes = await canvas.encode("jpeg", 85),
      path = `${memory.event_id}/${actor.id}/${randomUUID()}.jpg`;
    // Hide from broader audiences before any new photo can be attached.
    await appDB(`woo_v1_memories?id=eq.${memory.id}&owner_id=eq.${actor.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "pending", updated_at: new Date().toISOString() }),
    });
    await storage(`object/${bucket}/${path}`, {
      method: "POST",
      body: new Uint8Array(bytes),
      headers: { "Content-Type": "image/jpeg", "x-upsert": "false" },
    });
    try {
      await appDB("woo_v1_memory_assets", {
        method: "POST",
        body: JSON.stringify({
          memory_id: memory.id,
          owner_id: actor.id,
          storage_path: path,
          mime_type: "image/jpeg",
          bytes: bytes.length,
        }),
      });
    } catch (error) {
      // A timed-out insert may have committed; clean both records and the object.
      await appDB(
        `woo_v1_memory_assets?storage_path=eq.${encodeURIComponent(path)}&owner_id=eq.${actor.id}`,
        { method: "DELETE" },
      );
      await storage(`object/${bucket}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: [path] }),
      });
      throw error;
    }
    return respond(request, { uploaded: true }, 201);
  } catch (error) {
    return errorResponse(request, error);
  }
}
