import { test } from "node:test";
import assert from "node:assert/strict";
import { dataUriToBlob } from "../src/download-util.js";

// dataUriToBlob splits a `data:` URI into the { mimeType, blob } shape app.downloadFile needs.
// The engine produces clean `data:image/png;base64,...` URIs, but the parser must also accept
// the RFC 2397 forms a host or canvas export could hand back.

test("splits a plain base64 PNG data URI", () => {
  const blob = "AAECAwQF";
  assert.deepEqual(dataUriToBlob(`data:image/png;base64,${blob}`), { mimeType: "image/png", blob });
});

test("keeps the base64 payload when extra params precede ;base64", () => {
  // RFC 2397 permits `;param=value` attributes between the mime and the payload. The old
  // `(;base64)?` regex rejected this and returned null; the param-aware regex accepts it.
  const blob = "AAECAwQF";
  assert.deepEqual(dataUriToBlob(`data:image/png;charset=utf-8;base64,${blob}`), {
    mimeType: "image/png",
    blob,
  });
});

test("defaults the mime type when the URI omits it", () => {
  assert.deepEqual(dataUriToBlob("data:;base64,AAEC"), { mimeType: "image/png", blob: "AAEC" });
});

test("percent-decodes a non-base64 payload to base64", () => {
  // %00%01%02 are three raw bytes; base64 of [0,1,2] is "AAEC".
  assert.deepEqual(dataUriToBlob("data:image/png,%00%01%02"), { mimeType: "image/png", blob: "AAEC" });
});

test("returns null for a non-data URI", () => {
  assert.equal(dataUriToBlob("https://example.com/x.png"), null);
});
