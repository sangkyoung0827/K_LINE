import { ClubPageError } from "./validation";
import sharp from "sharp";
export const MAX_MEDIA_BYTES = 4_000_000;
export function validateImage(
  bytes: Uint8Array,
  mime: string,
  name: string,
): "jpg" | "png" | "webp" {
  const signature = Buffer.from(bytes);
  const format =
    mime === "image/jpeg" &&
    signature[0] === 0xff &&
    signature[1] === 0xd8 &&
    signature[2] === 0xff
      ? "jpg"
      : mime === "image/png" &&
          signature
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? "png"
        : mime === "image/webp" &&
            signature.toString("ascii", 0, 4) === "RIFF" &&
            signature.toString("ascii", 8, 12) === "WEBP"
          ? "webp"
          : null;
  if (
    !format ||
    bytes.length < 12 ||
    bytes.length > MAX_MEDIA_BYTES ||
    !(format === "jpg" ? /\.jpe?g$/i : new RegExp(`\\.${format}$`, "i")).test(
      name,
    )
  ) {
    throw new ClubPageError(
      "이미지를 업로드하지 못했습니다. 4MB 이하 JPEG, PNG, WebP 파일을 선택해 주세요.",
    );
  }
  return format;
}
export async function normalizeImage(
  bytes: Buffer,
  mime: string,
  name: string,
) {
  const extension = validateImage(bytes, mime, name);
  try {
    // Decode with a pixel bound and re-encode, stripping metadata and trailing payloads.
    const image = sharp(bytes, {
      limitInputPixels: 24_000_000,
      animated: false,
      failOn: "warning",
    })
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      });
    const output = await image
      .toFormat(extension === "jpg" ? "jpeg" : extension)
      .toBuffer();
    if (output.length > MAX_MEDIA_BYTES) throw new Error("Image too large");
    return { bytes: output, extension };
  } catch {
    throw new ClubPageError(
      "이미지를 업로드하지 못했습니다. 손상되지 않은 2,400만 화소 이하 이미지를 선택해 주세요.",
    );
  }
}
