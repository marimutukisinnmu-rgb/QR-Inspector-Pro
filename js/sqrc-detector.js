/**
 * QR mode-inspection helpers.
 *
 * IMPORTANT:
 * - "0100" is the 4-bit Byte-mode indicator in a standard QR Code bitstream.
 * - The proprietary SQRC mode signature is not guessed here.
 * - Provide the verified DENSO WAVE signature via options.sqrcModeIndicators.
 * - This module inspects recovered data bits/codewords only; it cannot recover
 *   those bits from a raster image by itself.
 */
const STANDARD_QR_MODE_NAMES = new Map([
  ["0000", "Terminator"],
  ["0001", "Numeric"],
  ["0010", "Alphanumeric"],
  ["0011", "Structured Append"],
  ["0100", "Byte"],
  ["0101", "FNC1 First Position"],
  ["0111", "ECI"],
  ["1000", "Kanji"],
  ["1001", "FNC1 Second Position"]
]);

export function bytesToBitString(bytes) {
  return Array.from(bytes || [], byte => Number(byte).toString(2).padStart(8, "0")).join("");
}

export function readBitString(bytesOrBits, start = 0, length = 4) {
  const bits = typeof bytesOrBits === "string" ? bytesOrBits : bytesToBitString(bytesOrBits);
  if (!Number.isInteger(start) || !Number.isInteger(length) || start < 0 || length < 1 || start + length > bits.length) {
    return null;
  }
  return bits.slice(start, start + length);
}

/**
 * Classify a recovered standard QR data bitstream using its first mode bits.
 * sqrcModeIndicators must contain verified proprietary marker bit strings.
 * An unknown/reserved mode is only "possible SQRC/unsupported", never proof.
 */
export function classifyStandardQrMode(bytesOrBits, options = {}) {
  const bits = typeof bytesOrBits === "string" ? bytesOrBits : bytesToBitString(bytesOrBits);
  const indicator = readBitString(bits, 0, 4);
  if (indicator === null) return { status: "insufficient-data", indicator: null, mode: null };

  const proprietary = (options.sqrcModeIndicators || [])
    .map(value => String(value).replace(/\s+/g, ""))
    .filter(value => /^[01]{4}$/.test(value));

  if (proprietary.includes(indicator)) {
    return { status: "sqrc-marker-match", indicator, mode: "SQRC proprietary mode" };
  }

  if (STANDARD_QR_MODE_NAMES.has(indicator)) {
    return { status: "standard-mode", indicator, mode: STANDARD_QR_MODE_NAMES.get(indicator) };
  }

  return { status: "unknown-mode", indicator, mode: null };
}

export function getSqrcMessage(classification) {
  if (classification?.status === "sqrc-marker-match") {
    return "SQRCの専用モード指示子と一致しました。通常のテキスト解釈を停止し、実際に回収できたデータだけを表示します。";
  }
  if (classification?.status === "unknown-mode") {
    return "標準QRの既知のモード指示子ではありません。SQRCの可能性がありますが、専用指示子との一致を確認できるまでは断定しません。";
  }
  if (classification?.status === "insufficient-data") {
    return "モード指示子を判定するためのビット数が不足しています。";
  }
  return "標準QRのモード指示子を検出しました。これはSQRCでないことの証明にはなりません。";
}

export const STANDARD_QR_MODE_INDICATORS = Object.freeze(
  Object.fromEntries(STANDARD_QR_MODE_NAMES.entries())
);