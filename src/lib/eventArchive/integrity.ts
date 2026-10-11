import { createHash } from "node:crypto";
import JSZip from "jszip";
import { ArchiveError, type ArchiveFile } from "./model";

export const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
export async function verifyOriginalFile(file: ArchiveFile, bytes: Uint8Array) {
  if (bytes.byteLength !== file.size || sha256(bytes) !== file.sha256) throw new ArchiveError("ORIGINAL_HASH_MISMATCH", 422);
  const b = Buffer.from(bytes), mime = file.mimeType;
  const valid = mime === "image/png" ? b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
    mime === "image/jpeg" ? b[0] === 255 && b[1] === 216 && b[2] === 255 && b.at(-2) === 255 && b.at(-1) === 217 :
    mime === "image/gif" ? /^GIF8[79]a/.test(b.subarray(0, 6).toString("ascii")) :
    mime === "image/webp" ? b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" :
    mime === "application/pdf" ? b.subarray(0, 5).toString("ascii") === "%PDF-" && b.subarray(-2048).includes(Buffer.from("%%EOF")) :
    mime.startsWith("text/") ? true : b[0] === 80 && b[1] === 75 && b[2] === 3 && b[3] === 4;
  if (!valid) throw new ArchiveError("FILE_SIGNATURE_MISMATCH", 422);
  if (mime === "application/pdf" && /\/(?:JavaScript|JS|Launch|EmbeddedFile)\b/.test(b.toString("latin1"))) throw new ArchiveError("ACTIVE_DOCUMENT_NOT_ALLOWED", 422);
  if (mime.includes("openxmlformats")) {
    const zip = await JSZip.loadAsync(b, { checkCRC32: false });
    const names = Object.keys(zip.files);
    const root = mime.includes("wordprocessing") ? "word/document.xml" : "ppt/presentation.xml";
    if (names.length > 2000 || !names.includes("[Content_Types].xml") || !names.includes(root) ||
      names.some(n => /(?:vbaProject|embeddings\/|\.exe$|\.js$|\.html?$|\.svg$)/i.test(n))) throw new ArchiveError("UNSAFE_OFFICE_DOCUMENT", 422);
    // Bound decompression before parsing XML, including zip bombs and relationship files.
    let expanded = 0;
    for (const entry of Object.values(zip.files)) {
      const sizes = (entry as unknown as { _data?: { uncompressedSize: number; compressedSize: number } })._data;
      if (sizes) {
        expanded += sizes.uncompressedSize;
        if (expanded > 50 * 1024 * 1024 || sizes.uncompressedSize > 10 * 1024 * 1024 || sizes.uncompressedSize > Math.max(100000, sizes.compressedSize * 100)) throw new ArchiveError("UNSAFE_OFFICE_DOCUMENT", 422);
      }
    }
  }
  if (mime.startsWith("text/")) {
    try { new TextDecoder("utf-8", { fatal: true }).decode(b); } catch { throw new ArchiveError("UTF8_TEXT_FILE_REQUIRED", 422); }
  }
  return bytes;
}
