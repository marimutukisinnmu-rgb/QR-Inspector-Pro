const QR_FORMATS = ["QRCode", "QRCodeModel1", "QRCodeModel2", "MicroQRCode", "RMQRCode"];

export function getDecoder() {
  const api = globalThis.ZXingWASM;
  if (!api || typeof api.readBarcodes !== "function") {
    throw new Error("ZXing WebAssemblyを読み込めません。インターネット接続またはCDNを確認してください。");
  }
  return api;
}

/**
 * Reads an ImageData, Blob, File, or supported image byte input with ZXing-C++.
 * Result bytes are copied out of WASM-backed memory immediately.
 *
 * Important: result.bytes is decoded payload data provided by the decoder,
 * not QR codewords, a raw module grid, or a guarantee of the original bitstream.
 */
export async function decodeImage(input) {
  const api = getDecoder();
  const results = await api.readBarcodes(input, {
    formats: QR_FORMATS,
    tryHarder: true,
    tryRotate: true,
    tryInvert: true,
    maxNumberOfSymbols: 10,
    textMode: "Plain",
  });

  return (results || [])
    .filter(item => item && !item.error && (item.format || item.symbology))
    .map(item => ({
      format: String(item.format || item.symbology || "Unknown"),
      symbology: String(item.symbology || item.format || "Unknown"),
      text: typeof item.text === "string" ? item.text : "",
      bytes: item.bytes ? new Uint8Array(item.bytes) : null,
      bytesECI: item.bytesECI ? new Uint8Array(item.bytesECI) : null,
      hasECI: Boolean(item.hasECI),
      contentType: item.contentType ?? null,
      version: item.version ?? null,
      ecLevel: item.ecLevel ?? "",
      position: item.position ?? null,
      rotation: item.rotation ?? null,
      isMirrored: Boolean(item.isMirrored),
      isInverted: Boolean(item.isInverted),
      symbologyIdentifier: item.symbologyIdentifier ?? "",
      sequenceSize: item.sequenceSize ?? null,
      sequenceIndex: item.sequenceIndex ?? null,
      sequenceId: item.sequenceId ?? null,
      extra: item.extra ?? "",
    }));
}

export function formatName(format) {
  const names = {
    QRCode: "通常QRコード（モデル2系）",
    QRCodeModel1: "QRコード Model 1",
    QRCodeModel2: "QRコード Model 2",
    MicroQRCode: "Micro QR",
    RMQRCode: "rMQR（長方形QR）",
  };
  return names[format] || format || "不明";
}

/**
 * SQRC keeps the visual/symbology appearance of regular QR. A generic decoder
 * cannot reliably identify SQRC solely from the printed pattern. Never infer
 * SQRC from garbled text or claim its private payload was recovered.
 */
export function sqrcDetectionNotice() {
  return "SQRCは通常QRコードと同じ外観・基本特性を持つため、この汎用デコーダーだけでは確実に自動判定できません。表示するバイト列はデコーダーが実際に返した取得済みペイロードです。";
}