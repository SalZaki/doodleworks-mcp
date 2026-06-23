import { test } from "node:test";
import assert from "node:assert/strict";
import { sniffImageMime } from "../engine.js";

// sniffImageMime reads an image's magic bytes from its base64 payload so the OpenAI return path
// labels the data-URI by what the bytes actually are instead of assuming PNG.

const b64 = (bytes: number[]) => Buffer.from(bytes).toString("base64");

test("detects PNG from its 8-byte signature", () => {
  assert.equal(sniffImageMime(b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
});

test("detects JPEG from its SOI marker", () => {
  assert.equal(sniffImageMime(b64([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])), "image/jpeg");
});

test("detects WebP from the RIFF/WEBP header", () => {
  // "RIFF" + 4 size bytes + "WEBP"
  const bytes = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
  assert.equal(sniffImageMime(b64(bytes)), "image/webp");
});

test("detects GIF from the GIF8 header", () => {
  assert.equal(sniffImageMime(b64([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])), "image/gif");
});

test("falls back to image/png for unrecognized bytes", () => {
  assert.equal(sniffImageMime(b64([0x00, 0x01, 0x02, 0x03])), "image/png");
});

test("falls back to image/png for an unparseable payload", () => {
  assert.equal(sniffImageMime("not-valid-base64!!!"), "image/png");
});
