export function parseHex(input) {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) throw new Error("HEXデータが空です。");
  const tokens = trimmed.split(/[\s,:;-]+/).filter(Boolean);
  if (tokens.some(token => !/^(?:0x)?[0-9a-f]{2}$/i.test(token))) {
    throw new Error("各バイトを2桁の16進数で入力してください（例: 00 FF 80）。");
  }
  return Uint8Array.from(tokens, token => Number.parseInt(token.replace(/^0x/i, ""), 16));
}

export function bytesToHex(bytes) {
  return Array.from(bytes, value => value.toString(16).toUpperCase().padStart(2, "0")).join(" ");
}

export function bytesToAscii(bytes) {
  return Array.from(bytes, value => value >= 0x20 && value <= 0x7e ? String.fromCharCode(value) : ".").join("");
}

export function bytesToUtf8(bytes) {
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), valid: true };
  } catch {
    return { text: "", valid: false };
  }
}

export function detectImageMime(bytes) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 6 && (bytesToAscii(bytes.subarray(0, 6)) === "GIF87a" || bytesToAscii(bytes.subarray(0, 6)) === "GIF89a")) return "image/gif";
  if (bytes.length >= 12 && bytesToAscii(bytes.subarray(0, 4)) === "RIFF" && bytesToAscii(bytes.subarray(8, 12)) === "WEBP") return "image/webp";
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
  if (bytes.length >= 4 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) return "image/x-icon";
  return "";
}

export function classifyPayload(bytes, text = "") {
  const mime = detectImageMime(bytes);
  if (mime) return { kind: "画像バイナリ", mime };
  if (/^https?:\/\//i.test(text)) return { kind: "URL", mime: "" };
  if (/^data:image\//i.test(text)) return { kind: "画像Data URL", mime: "" };
  const decoded = bytesToUtf8(bytes);
  if (decoded.valid && /^[\x09\x0a\x0d\x20-\x7e]*$/.test(decoded.text)) return { kind: "テキスト", mime: "" };
  if (decoded.valid) return { kind: "UTF-8テキスト（非ASCII）", mime: "" };
  return { kind: "バイナリ / UTF-8以外", mime: "" };
}

/**
 * A standard Model 2 QR has side length 21 + 4 * (version - 1).
 * This validates a known module-grid dimension; it does not infer a version
 * from an arbitrary raster image's pixel dimensions.
 */
export function standardQrVersionFromModules(sideModules) {
  if (!Number.isInteger(sideModules) || sideModules < 21 || sideModules > 177 || (sideModules - 21) % 4 !== 0) return null;
  return (sideModules - 21) / 4 + 1;
}