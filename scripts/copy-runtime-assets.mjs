// Copies runtime-only asset trees into dist/ so the published package is
// self-contained. The server reads references/*.md at runtime (the bundled
// doc://doodleworks/* resources); in the packaged layout the compiled entry
// lives in dist/, so the references must live in dist/ too.
// MUST run AFTER `vite build` (vite empties dist/) and after the tsc emit.
import { cpSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.dirname(import.meta.dirname);
const from = path.join(root, "references");
const to = path.join(root, "dist", "references");

if (!existsSync(from)) {
  console.error(`[copy-runtime-assets] missing source dir: ${from}`);
  process.exit(1);
}
cpSync(from, to, { recursive: true });
console.log(`[copy-runtime-assets] copied references/ -> dist/references/`);
