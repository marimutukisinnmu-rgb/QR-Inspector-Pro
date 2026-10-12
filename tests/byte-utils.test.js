import test from "node:test";
import assert from "node:assert/strict";
import {
  parseHex, bytesToHex, bytesToAscii, bytesToUtf8,
  detectImageMime, classifyPayload, standardQrVersionFromModules
} from "../js/byte-utils.js";

test("HEX parser preserves exact bytes", () => {
  const bytes = parseHex("00 ff 0x80, 41:42");
  assert.deepEqual(Array.from(bytes), [0x00, 0xff, 0x80, 0x41, 0x42]);
  assert.equal(bytesToHex(bytes), "00 FF 80 41 42");
});

test("HEX parser rejects malformed tokens", () => {
  assert.throws(() => parseHex("0G FF"), /2桁の16進数/);
  assert.throws(() => parseHex("F"), /2桁の16進数/);
  assert.throws(() => parseHex(""), /空です/);
});

test("ASCII view keeps byte count and replaces non-printables", () => {
  assert.equal(bytesToAscii(Uint8Array.of(0x41, 0x00, 0xff, 0x7e)), "A..~");
});

test("UTF-8 validation does not fabricate a valid decode", () => {
  assert.deepEqual(bytesToUtf8(Uint8Array.of(0x41, 0x42)), { text: "AB", valid: true });
  assert.deepEqual(bytesToUtf8(Uint8Array.of(0xc3, 0x28)), { text: "", valid: false });
});

test("image signatures are recognized only from the actual payload bytes", () => {
  assert.equal(detectImageMime(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), "image/png");
  assert.equal(classifyPayload(Uint8Array.of(0xff, 0xd8, 0xff)).kind, "画像バイナリ");
  assert.equal(detectImageMime(Uint8Array.of(0x48, 0x65, 0x6c, 0x6c, 0x6f)), "");
});

test("standard QR version formula uses module-grid dimensions, not raster pixels", () => {
  assert.equal(standardQrVersionFromModules(21), 1);
  assert.equal(standardQrVersionFromModules(25), 2);
  assert.equal(standardQrVersionFromModules(177), 40);
  assert.equal(standardQrVersionFromModules(26), null);
  assert.equal(standardQrVersionFromModules(400), null);
});