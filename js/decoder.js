const QR_FORMATS = ["QRCode", "QRCodeModel1", "QRCodeModel2", "MicroQRCode", "RMQRCode"];

export function getDecoder() {
  const api = globalThis.ZXingWASM;
  if (!api || typeof api.readBarcodes !== "function") {
    throw new Error("ZXing WebAssemblyを読み込めません。インターネット接続またはCDNを確認してください。");
  }
  return api;
}

/**
 * Decode image input via ZXing-C++ WebAssembly.
 * ReadResult.bytes is the decoder's raw/standard payload content (without
 * character-set conversion). It is NOT the complete QR codeword stream or
 * a dump of all QR module bits.
 */
export async function decodeImage(input) {
  const api = getDecoder();
  const results = await api.readBarcodes(input, {
    formats: QR_FORMATS,
    tryHarder: true,
    tryRotate: true,
    tryInvert: true,
    tryDownscale: true,
    maxNumberOfSymbols: 10,
    textMode: "Plain",
    characterSet: "Unknown"
  });

  return (results || [])
    .filter(item => item && !item.error && item.isValid !== false && (item.format || item.symbology))
    .map(item => ({
      format: String(item.format || item.symbology || "Unknown"),
      symbology: String(item.symbology || item.format || "Unknown"),
      text: typeof item.text === "string" ? item.text : "",
      bytes: item.bytes instanceof Uint8Array ? new Uint8Array(item.bytes) : null,
      bytesECI: item.bytesECI instanceof Uint8Array ? new Uint8Array(item.bytesECI) : null,
      hasECI: Boolean(item.hasECI),
      contentType: item.contentType ?? null,
      version: item.version ?? null,
      ecLevel: item.ecLevel ?? "",
      position: item.position ?? null,
      rotation: item.rotation ?? item.orientation ?? null,
      isMirrored: Boolean(item.isMirrored),
      isInverted: Boolean(item.isInverted),
      symbologyIdentifier: item.symbologyIdentifier ?? "",
      sequenceSize: item.sequenceSize ?? null,
      sequenceIndex: item.sequenceIndex ?? null,
      sequenceId: item.sequenceId ?? null,
      symbol: item.symbol && item.symbol.data instanceof Uint8ClampedArray
        ? { data: new Uint8ClampedArray(item.symbol.data), width: item.symbol.width, height: item.symbol.height }
        : null,
      extra: item.extra ?? ""
    }));
}

export function formatName(format) {
  const names = {
    QRCode: "QRコード",
    QRCodeModel1: "QRコード Model 1",
    QRCodeModel2: "QRコード Model 2",
    MicroQRCode: "Micro QR",
    RMQRCode: "rMQR（長方形QR）"
  };
  return names[format] || format || "不明";
}

export function sqrcDetectionNotice() {
  return "SQRCは通常QRと同じ外観で、公開部と非公開部を持ちます。通常のデコード結果だけではSQRCかどうかを確定できません。0100は標準QRの4ビットByteモード指示子です。SQRCの独自モード検出には、誤り訂正後のデータビットストリームと、検証済みの専用指示子が必要です。";
}