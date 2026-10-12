import { parseHex, bytesToHex, bytesToAscii, bytesToUtf8, classifyPayload, detectImageMime } from "./byte-utils.js";
import { decodeImage, formatName, sqrcDetectionNotice } from "./decoder.js";

const $ = id => document.getElementById(id);
const state = {
  bytes: new Uint8Array(), text: "", decodedText: "", activeResult: null,
  bytesAreExact: false, view: "hex", stream: null, scanning: false,
  scanBusy: false, lastScan: 0, imageUrl: "", dataImageUrl: "", results: []
};

function setStatus(message, tone = "") {
  const node = $("status");
  node.textContent = message;
  node.dataset.tone = tone;
}
function safeUtf8(bytes) { return new TextDecoder("utf-8", { fatal: false }).decode(bytes); }
function makeChip(text) {
  const node = document.createElement("span");
  node.className = "chip";
  node.textContent = text;
  return node;
}
function showMeta(items) {
  const container = $("meta-grid");
  container.replaceChildren();
  for (const [label, value] of items) {
    const card = document.createElement("div");
    card.className = "meta-item";
    const title = document.createElement("span");
    title.textContent = label;
    const content = document.createElement("strong");
    content.textContent = value === null || value === undefined || value === "" ? "—" : String(value);
    card.append(title, content);
    container.appendChild(card);
  }
}
function setPayload(bytes, text, source, exact = true) {
  state.bytes = new Uint8Array(bytes || []);
  state.text = String(text ?? "");
  state.decodedText = state.text;
  state.bytesAreExact = Boolean(exact);
  $("result-text").textContent = state.text || (state.bytes.length ? "(空のテキスト表示。バイト列を確認してください)" : "(空データ)");
  $("payload-source").textContent = source;
  $("payload-size").textContent = state.bytes.length.toLocaleString() + " bytes";
  $("payload-exactness").textContent = state.bytesAreExact
    ? "デコーダーまたは入力から取得したバイト列"
    : "文字列をUTF-8変換したバイト列（元バイト列ではありません）";
  $("hex-input").value = bytesToHex(state.bytes);
  $("force-read").disabled = !state.activeResult || !state.bytesAreExact;
  $("download-payload").disabled = state.bytes.length === 0;
  $("copy-hex").disabled = state.bytes.length === 0;
  $("copy-text").disabled = !state.text;
  $("result-chips").replaceChildren(
    makeChip(state.bytes.length.toLocaleString() + " bytes"),
    makeChip(classifyPayload(state.bytes, state.text).kind)
  );
  renderBinary();
  renderImagePayload();
}
function renderBinary() {
  const target = $("hex-dump");
  target.replaceChildren();
  if (state.view === "text") {
    const pre = document.createElement("pre");
    pre.className = "result-box";
    pre.textContent = safeUtf8(state.bytes) || "(空データ)";
    target.appendChild(pre);
    return;
  }
  if (!state.bytes.length) {
    target.textContent = "データなし";
    return;
  }
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const trHead = document.createElement("tr");
  for (const label of ["Offset", "HEX (16 bytes)", "ASCII"]) {
    const th = document.createElement("th");
    th.textContent = label;
    trHead.appendChild(th);
  }
  head.appendChild(trHead);
  table.appendChild(head);
  const body = document.createElement("tbody");
  const rows = Math.min(Math.ceil(state.bytes.length / 16), 5000);
  for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
    const offset = rowIndex * 16;
    const part = state.bytes.subarray(offset, offset + 16);
    const tr = document.createElement("tr");
    const tdOffset = document.createElement("td");
    const tdHex = document.createElement("td");
    const tdAscii = document.createElement("td");
    tdOffset.textContent = offset.toString(16).toUpperCase().padStart(8, "0");
    tdHex.className = "hex";
    tdHex.textContent = bytesToHex(part);
    tdAscii.className = "ascii";
    tdAscii.textContent = bytesToAscii(part);
    tr.append(tdOffset, tdHex, tdAscii);
    body.appendChild(tr);
  }
  table.appendChild(body);
  target.appendChild(table);
  if (Math.ceil(state.bytes.length / 16) > rows) {
    const note = document.createElement("p");
    note.className = "row-note";
    note.textContent = "先頭 " + rows.toLocaleString() + " 行を表示中。保存すると全 " + state.bytes.length.toLocaleString() + " bytes が出力されます。";
    target.appendChild(note);
  }
}
function revokePayloadImageUrl() {
  if (state.dataImageUrl) URL.revokeObjectURL(state.dataImageUrl);
  state.dataImageUrl = "";
  $("payload-image").replaceChildren();
}
function revokeImageUrls() {
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  state.imageUrl = "";
  revokePayloadImageUrl();
}
function renderImagePayload() {
  revokePayloadImageUrl();
  const mime = detectImageMime(state.bytes);
  const output = $("payload-image");
  if (mime && state.bytes.length) {
    state.dataImageUrl = URL.createObjectURL(new Blob([state.bytes], { type: mime }));
    const img = document.createElement("img");
    img.alt = "ペイロード内画像 (" + mime + ")";
    img.src = state.dataImageUrl;
    img.addEventListener("error", () => {
      output.textContent = "画像ヘッダーは見つかりましたが、ブラウザで画像として表示できませんでした。";
    }, { once: true });
    output.appendChild(img);
    const note = document.createElement("p");
    note.className = "row-note";
    note.textContent = "実際のペイロード先頭から画像形式を検出: " + mime;
    output.appendChild(note);
  } else {
    output.textContent = "画像バイナリは検出されていません。テキストのURLや通常のQR画像は、それだけでは画像ファイル本体ではありません。";
  }
}
function clearSqrcNotice() { $("sqrc-notice").classList.add("hidden"); }
function showPossibleSqrcNotice(extra = "") {
  $("sqrc-notice").classList.remove("hidden");
  $("sqrc-notice-text").textContent = extra ||
    "QRらしい画像を復号できませんでした。画質・画像の傾き・対応外の形式・SQRCの専用モードなど、複数の可能性があります。現時点ではSQRCと断定できません。";
}
function showDecodeResult(result) {
  state.activeResult = result;
  clearSqrcNotice();
  const bytes = result.bytes instanceof Uint8Array ? result.bytes : null;
  const bytesEci = result.bytesECI instanceof Uint8Array ? result.bytesECI : null;
  const payloadBytes = bytes || bytesEci;
  const exact = payloadBytes !== null;
  const data = payloadBytes || new TextEncoder().encode(result.text || "");
  const source = bytes ? "ZXing ReadResult.bytes (取得ペイロード)" :
    bytesEci ? "ZXing ReadResult.bytesECI (ECIデータ)" : "デコーダー文字列からのUTF-8変換";
  setPayload(data, result.text || safeUtf8(data), source, exact);
  $("decoded-format").textContent = formatName(result.format);
  $("decoded-extra").textContent = sqrcDetectionNotice();
  showMeta([
    ["規格", formatName(result.format)],
    ["バージョン", result.version || "デコーダーから情報なし"],
    ["誤り訂正レベル", result.ecLevel || "デコーダーから情報なし"],
    ["内容タイプ", result.contentType || "不明"],
    ["ECI", result.hasECI ? "あり" : "なし / 情報なし"],
    ["回転", result.rotation === null || result.rotation === undefined ? "—" : String(result.rotation) + "°"],
    ["ミラー", result.isMirrored ? "あり" : "なし"],
    ["反転", result.isInverted ? "あり" : "なし"]
  ]);
  $("force-read").disabled = !exact;
  $("normal-read").disabled = !result.text;
  setStatus(formatName(result.format) + " を検出しました。ペイロード " + data.length + " bytes を取得しました。", "success");
}
async function readImageBlob(file) {
  if (!file || !file.type.startsWith("image/")) {
    setStatus("QR画像として読み取るには画像ファイルを選択してください。任意のバイナリはバイナリ読み込み欄から開けます。", "warn");
    return;
  }
  stopCamera();
  revokeImageUrls();
  state.results = [];
  const selector = $("result-selector");
  selector.replaceChildren(new Option("解析中…", ""));
  selector.disabled = true;
  state.imageUrl = URL.createObjectURL(file);
  const image = $("image-preview");
  image.src = state.imageUrl;
  image.classList.remove("hidden");
  $("image-preview-wrap").classList.remove("hidden");
  state.activeResult = null;
  state.bytesAreExact = false;
  $("normal-read").disabled = true;
  setPayload(new Uint8Array(), "", "解析中", false);
  $("decoded-format").textContent = "解析中";
  $("decoded-extra").textContent = "画像を解析しています。";
  setStatus("画像を解析しています…");
  try {
    const results = await decodeImage(file);
    if (!results.length) {
      state.activeResult = null;
      $("force-read").disabled = true;
      $("normal-read").disabled = true;
      $("decoded-format").textContent = "未判定";
      $("decoded-extra").textContent = "QRとして復号できませんでした。SQRCかどうかは確定できません。";
      showPossibleSqrcNotice();
      setStatus("対応するQRコードを復号できませんでした。SQRCかどうかは未判定です。", "warn");
      showMeta([["規格", "未判定"], ["取得バイト列", "なし"], ["状態", "未復号"]]);
      return;
    }
    state.results = results;
    const selector = $("result-selector");
    selector.replaceChildren(...results.map((result, index) => {
      const option = new Option(
        (index + 1) + ". " + formatName(result.format) + " — " + ((result.text || "").slice(0, 48) || (result.bytes?.length ?? 0) + " bytes"),
        String(index)
      );
      return option;
    }));
    selector.disabled = results.length < 2;
    selector.value = "0";
    showDecodeResult(results[0]);
    if (results.length > 1) {
      $("decoded-extra").textContent += " 画像内で " + results.length + " 件のコードが検出されました。上の選択欄から切り替えられます。";
    }
  } catch (error) {
    state.activeResult = null;
    $("force-read").disabled = true;
    $("normal-read").disabled = true;
    $("decoded-format").textContent = "解析エラー";
    $("decoded-extra").textContent = "QR画像の解析に失敗しました。";
    showPossibleSqrcNotice();
    setStatus("解析エラー: " + (error?.message || error), "error");
  }
}
async function readAnyFile(file) {
  if (file.type.startsWith("image/")) return readImageBlob(file);
  stopCamera();
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    state.activeResult = null;
    $("normal-read").disabled = true;
    const utf8 = bytesToUtf8(data);
    setPayload(data, utf8.valid ? utf8.text : "(UTF-8として無効。HEX/ASCIIで確認してください)", "ファイル入力: " + file.name, true);
    $("decoded-format").textContent = "QRではなくファイルのバイト列";
    $("decoded-extra").textContent = "ファイルをQRコードとしてデコードしたわけではありません。読み込んだファイルのバイト列をそのまま表示しています。";
    showMeta([["入力ファイル", file.name], ["MIME", file.type || "不明"], ["サイズ", data.length.toLocaleString() + " bytes"]]);
    $("force-read").disabled = true;
    setStatus(file.name + ": " + data.length.toLocaleString() + " bytes を読み込みました。", "success");
  } catch (error) {
    setStatus("ファイル読み込み失敗: " + (error?.message || error), "error");
  }
}
async function pasteFromClipboard() {
  try {
    if (!navigator.clipboard?.read) throw new Error("このブラウザでは画像付きクリップボード読み取りが使えません。Ctrl+Vで貼り付けてください。");
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find(type => type.startsWith("image/"));
      if (imageType) {
        const blob = await item.getType(imageType);
        await readImageBlob(new File([blob], "clipboard-image", { type: imageType }));
        return;
      }
    }
    for (const item of items) {
      if (item.types.includes("text/plain")) {
        $("text-input").value = await (await item.getType("text/plain")).text();
        $("text-input").focus();
        setStatus("クリップボードのテキストを入力欄に貼り付けました。解析ボタンを押してください。", "success");
        return;
      }
    }
    setStatus("クリップボードに対応する画像またはテキストがありません。", "warn");
  } catch (error) {
    setStatus(error?.message || "クリップボードを読み取れませんでした。Ctrl+Vで貼り付けてください。", "warn");
  }
}
function stopCamera() {
  state.scanning = false;
  if (state.stream) {
    for (const track of state.stream.getTracks()) track.stop();
    state.stream = null;
  }
  $("camera-video").srcObject = null;
  $("camera-wrap").classList.add("hidden");
  $("camera-start").disabled = false;
  $("camera-stop").disabled = true;
}
async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("カメラにはHTTPSまたはlocalhostが必要です。", "warn");
    return;
  }
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } }, audio: false
    });
    const video = $("camera-video");
    video.srcObject = state.stream;
    $("camera-wrap").classList.remove("hidden");
    await video.play();
    state.scanning = true;
    $("camera-start").disabled = true;
    $("camera-stop").disabled = false;
    setStatus("カメラをQRに向けてください。", "success");
    scanCameraFrame();
  } catch (error) {
    stopCamera();
    setStatus("カメラを起動できません: " + (error?.message || error), "error");
  }
}
async function scanCameraFrame() {
  if (!state.scanning || state.scanBusy) return;
  state.scanBusy = true;
  try {
    const video = $("camera-video");
    const now = performance.now();
    if (video.readyState >= 2 && now - state.lastScan > 300) {
      state.lastScan = now;
      const canvas = $("camera-canvas");
      const maxSide = 1400;
      const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const results = await decodeImage(context.getImageData(0, 0, canvas.width, canvas.height));
      if (results.length) {
        state.results = results;
        const selector = $("result-selector");
        selector.replaceChildren(...results.map((result, index) => new Option(
          (index + 1) + ". " + formatName(result.format) + " — " + ((result.text || "").slice(0, 48) || (result.bytes?.length ?? 0) + " bytes"),
          String(index)
        )));
        selector.disabled = results.length < 2;
        selector.value = "0";
        showDecodeResult(results[0]);
        stopCamera();
        state.scanBusy = false;
        return;
      }
    }
  } catch (error) {
    // A decode failure between camera frames is normal; keep scanning.
  }
  state.scanBusy = false;
  if (state.scanning) requestAnimationFrame(scanCameraFrame);
}
function applyHexInput() {
  try {
    const data = parseHex($("hex-input").value);
    state.activeResult = null;
    $("normal-read").disabled = true;
    const utf8 = bytesToUtf8(data);
    setPayload(data, utf8.valid ? utf8.text : "(UTF-8として無効。HEX/ASCIIで確認してください)", "手動HEX入力", true);
    $("decoded-format").textContent = "手動HEX入力";
    $("decoded-extra").textContent = "HEX入力欄の値をバイト列として扱っています。QRデコード結果ではありません。";
    showMeta([["入力", "手動HEX"], ["バイト数", data.length], ["UTF-8", utf8.valid ? "有効" : "無効"]]);
    $("force-read").disabled = true;
    setStatus(data.length.toLocaleString() + " bytes をHEXとして解析しました。", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}
function applyTextInput() {
  const value = $("text-input").value;
  const data = new TextEncoder().encode(value);
  state.activeResult = null;
  $("normal-read").disabled = true;
  setPayload(data, value, "テキスト入力をUTF-8変換", false);
  $("decoded-format").textContent = "テキスト入力";
  $("decoded-extra").textContent = "テキストから生成したUTF-8バイト列です。QRコードから復元した元データではありません。";
  showMeta([["入力", "テキスト"], ["UTF-8バイト数", data.length], ["元QRデータ", "なし"]]);
  $("force-read").disabled = true;
  setStatus(data.length.toLocaleString() + " bytes のUTF-8テキストを作成しました。", "success");
}
async function copyText(text, description) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus(description + "をクリップボードにコピーしました。", "success");
  } catch {
    setStatus("クリップボードにアクセスできません。テキストを手動で選択してください。", "warn");
  }
}
function clearAll() {
  stopCamera();
  revokeImageUrls();
  state.bytes = new Uint8Array();
  state.text = "";
  state.decodedText = "";
  state.activeResult = null;
  state.results = [];
  state.bytesAreExact = false;
  state.view = "hex";
  $("result-selector").replaceChildren(new Option("未検出", ""));
  $("result-selector").disabled = true;
  $("image-file").value = "";
  $("binary-file").value = "";
  $("image-preview").removeAttribute("src");
  $("image-preview-wrap").classList.add("hidden");
  $("result-text").textContent = "未解析";
  $("decoded-format").textContent = "—";
  $("decoded-extra").textContent = "解析結果がここに表示されます。";
  $("payload-source").textContent = "—";
  $("payload-size").textContent = "0 bytes";
  $("payload-exactness").textContent = "—";
  $("result-chips").replaceChildren();
  $("hex-input").value = "";
  $("text-input").value = "";
  $("hex-dump").textContent = "データなし";
  $("meta-grid").replaceChildren();
  $("download-payload").disabled = true;
  $("copy-hex").disabled = true;
  $("copy-text").disabled = true;
  $("normal-read").disabled = true;
  $("force-read").disabled = true;
  clearSqrcNotice();
  renderImagePayload();
  setStatus("クリアしました。", "success");
}

$("image-file").addEventListener("change", event => readImageBlob(event.target.files?.[0]));
$("binary-file").addEventListener("change", event => readAnyFile(event.target.files?.[0]));
const dropZone = $("drop-zone");
dropZone.addEventListener("dragover", event => { event.preventDefault(); dropZone.classList.add("over"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("over"));
dropZone.addEventListener("drop", event => {
  event.preventDefault();
  dropZone.classList.remove("over");
  const file = event.dataTransfer.files?.[0];
  if (file) readAnyFile(file);
  else setStatus("ドロップされたデータをファイルとして読み取れませんでした。", "warn");
});
document.addEventListener("paste", event => {
  const focus = document.activeElement;
  const isEditing = focus && focus.matches("input, textarea, [contenteditable=true]");
  if (isEditing) return;
  const imageItem = Array.from(event.clipboardData?.items || []).find(item => item.type.startsWith("image/"));
  if (imageItem) {
    const file = imageItem.getAsFile();
    if (file) readImageBlob(file);
    return;
  }
  const text = event.clipboardData?.getData("text/plain");
  if (text) {
    $("text-input").value = text;
    setStatus("クリップボードのテキストを入力欄に貼り付けました。解析ボタンでバイト列に変換できます。", "success");
  }
});
$("paste-button").addEventListener("click", pasteFromClipboard);
$("camera-start").addEventListener("click", startCamera);
$("camera-stop").addEventListener("click", stopCamera);
$("apply-hex").addEventListener("click", applyHexInput);
$("apply-text").addEventListener("click", applyTextInput);
$("view-hex").addEventListener("click", () => {
  state.view = "hex";
  $("view-hex").setAttribute("aria-pressed", "true");
  $("view-text").setAttribute("aria-pressed", "false");
  renderBinary();
});
$("view-text").addEventListener("click", () => {
  state.view = "text";
  $("view-hex").setAttribute("aria-pressed", "false");
  $("view-text").setAttribute("aria-pressed", "true");
  renderBinary();
});
$("result-selector").addEventListener("change", event => {
  const index = Number.parseInt(event.target.value, 10);
  if (Number.isInteger(index) && state.results[index]) showDecodeResult(state.results[index]);
});
$("copy-text").addEventListener("click", () => copyText(state.text, "テキスト"));
$("copy-hex").addEventListener("click", () => copyText(bytesToHex(state.bytes), "HEX"));
$("normal-read").addEventListener("click", () => {
  $("result-text").textContent = state.decodedText || "(テキスト表示なし)";
  setStatus("デコーダーのテキスト解釈を表示しています。バイト列は変更していません。", "success");
});
$("force-read").addEventListener("click", () => {
  if (!state.activeResult || !state.bytesAreExact) {
    setStatus("デコーダーが取得したペイロードバイト列がありません。推測したデータは表示しません。", "warn");
    return;
  }
  $("result-text").textContent = safeUtf8(state.bytes);
  state.text = safeUtf8(state.bytes);
  setStatus("強制読み取り: 取得済みペイロードのバイト列をUTF-8として表示しました。元のバイト列は変更していません。", "success");
});
$("download-payload").addEventListener("click", () => {
  const blob = new Blob([state.bytes], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "qr-inspector-payload.bin";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$("clear-button").addEventListener("click", clearAll);
$("show-sqrc-info").addEventListener("click", () => $("sqrc-info").classList.toggle("hidden"));
window.addEventListener("pagehide", stopCamera);
setPayload(new Uint8Array(), "", "—", false);
showMeta([["規格", "未解析"], ["バイト列", "なし"]]);
setStatus("画像を選択するか、ドラッグ＆ドロップしてください。");
