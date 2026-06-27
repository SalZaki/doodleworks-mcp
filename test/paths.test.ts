import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { VIEWER_BUNDLE, REFERENCES_DIR } from "../paths.js";

test("VIEWER_BUNDLE points at the built single-file viewer", () => {
  assert.equal(path.basename(VIEWER_BUNDLE), "mcp-app.html");
  // After `pnpm build`, the dev-layout bundle exists at <root>/dist/mcp-app.html.
  assert.ok(existsSync(VIEWER_BUNDLE), `expected built bundle at ${VIEWER_BUNDLE} — run pnpm build`);
});

test("REFERENCES_DIR holds the bundled planning docs", () => {
  assert.ok(existsSync(path.join(REFERENCES_DIR, "visual-dna.md")), `expected references at ${REFERENCES_DIR}`);
});
