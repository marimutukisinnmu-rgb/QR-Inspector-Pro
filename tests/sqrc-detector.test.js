import test from "node:test";
import assert from "node:assert/strict";
import {
  bytesToBitString, readBitString, classifyStandardQrMode, getSqrcMessage
} from "../js/sqrc-detector.js";

test("0100 is the 4-bit Byte-mode indicator in a standard QR bitstream", () => {
  assert.equal(readBitString(Uint8Array.of(0x40), 0, 4), "0100");
  assert.deepEqual(classifyStandardQrMode("01000000"), {
    status: "standard-mode",
    indicator: "0100",
    mode: "Byte"
  });
});

test("bit extraction reports insufficient input instead of guessing", () => {
  assert.equal(readBitString("01", 0, 4), null);
  assert.equal(classifyStandardQrMode("01").status, "insufficient-data");
});

test("unrecognized mode is not automatically asserted to be SQRC", () => {
  const result = classifyStandardQrMode("11100000");
  assert.equal(result.status, "unknown-mode");
  assert.match(getSqrcMessage(result), /可能性があります/);
});

test("a verified proprietary marker can be injected without hardcoding a guessed value", () => {
  const testMarker = "1110"; // Test fixture only; not a claim about the real SQRC marker.
  const result = classifyStandardQrMode(testMarker + "0000", { sqrcModeIndicators: [testMarker] });
  assert.equal(result.status, "sqrc-marker-match");
  assert.match(getSqrcMessage(result), /専用モード指示子と一致/);
});

test("byte-to-bit conversion preserves leading zeroes", () => {
  assert.equal(bytesToBitString(Uint8Array.of(0x00, 0x0f, 0xff)), "000000000000111111111111");
});