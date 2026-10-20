// Content checks complement extension, MIME and stored-size validation.
export function validResourceHeader(bytes: Uint8Array, extension: string) {
  const b = Buffer.from(bytes), hex = b.subarray(0,8).toString("hex"), text = b.subarray(0,100).toString("ascii");
  if (extension === "pdf") return text.startsWith("%PDF-");
  if (["ppt","doc","xls","hwp"].includes(extension)) return hex === "d0cf11e0a1b11ae1";
  if (["pptx","docx","xlsx","hwpx","odt","odp","ods","zip"].includes(extension)) return hex.startsWith("504b0304");
  if (extension === "png") return hex === "89504e470d0a1a0a";
  if (["jpg","jpeg"].includes(extension)) return hex.startsWith("ffd8ff");
  if (extension === "gif") return text.startsWith("GIF87a") || text.startsWith("GIF89a");
  if (extension === "webp") return text.startsWith("RIFF") && text.slice(8,12) === "WEBP";
  if (extension === "rtf") return text.startsWith("{\\rtf");
  if (extension === "mp4") return text.slice(4,8) === "ftyp";
  if (extension === "mp3") return text.startsWith("ID3") || (b[0] === 255 && (b[1] & 224) === 224);
  return ["txt","csv"].includes(extension) && !b.includes(0);
}
