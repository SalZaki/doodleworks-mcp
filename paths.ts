/**
 * Resolve runtime asset locations in both layouts:
 *  - packaged (compiled): this module is emitted to dist/, with the viewer
 *    bundle (dist/mcp-app.html) and a copy of references/ co-located, so
 *    MODULE_DIR === <pkg>/dist.
 *  - source (tsx): this module is at the repo root; the built viewer is the
 *    vite output under dist/, and references/ is the source dir at the root.
 * The compiled output dir is always named "dist", which distinguishes the two.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGED = path.basename(MODULE_DIR) === "dist";

/** Absolute path to the built single-file viewer. */
export const VIEWER_BUNDLE = PACKAGED
  ? path.join(MODULE_DIR, "mcp-app.html")
  : path.join(MODULE_DIR, "dist", "mcp-app.html");

/** Directory holding the bundled doc://doodleworks/* planning resources. */
export const REFERENCES_DIR = path.join(MODULE_DIR, "references");
