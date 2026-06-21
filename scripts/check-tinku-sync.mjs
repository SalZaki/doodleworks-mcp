// Guards the invariant that Tinku is defined ONCE and copied verbatim.
//
// The TINKU_CHARACTER constant in engine.ts is the single source of truth for the
// character. references/visual-dna.md quotes it verbatim in a blockquote ("quoted
// here"). Those two MUST stay byte-for-byte identical — if they drift, the docs lie
// about what the engine actually bakes into every image, which is exactly how Tinku's
// look slid out of sync before. Nothing else enforces this, so this check does.
//
// Pure Node, no dependencies. Exits non-zero (failing the build) on any mismatch.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function fail(msg) {
  console.error(`\n✗ Tinku sync check FAILED\n  ${msg}\n`);
  process.exit(1);
}

// 1. Reconstruct the TINKU_CHARACTER string literal from engine.ts.
const engine = readFileSync(join(root, "engine.ts"), "utf8");
const constMatch = engine.match(/export const TINKU_CHARACTER =\s*([\s\S]*?);\n/);
if (!constMatch) fail("could not locate `export const TINKU_CHARACTER` in engine.ts");
const segments = constMatch[1].match(/"(?:[^"\\]|\\.)*"/g);
if (!segments || segments.length === 0) {
  fail("TINKU_CHARACTER did not parse as a string literal in engine.ts");
}
const fromEngine = segments.map((s) => JSON.parse(s)).join("");

// 2. Pull the verbatim quote from references/visual-dna.md (the "> Tinku is ..." blockquote).
const dna = readFileSync(join(root, "references", "visual-dna.md"), "utf8");
const quoteLine = dna.split("\n").find((l) => l.startsWith("> Tinku is"));
if (!quoteLine) fail('could not find the "> Tinku is ..." blockquote in references/visual-dna.md');
const fromDoc = quoteLine.replace(/^>\s/, "");

// 3. They must be identical.
if (fromEngine !== fromDoc) {
  const len = Math.max(fromEngine.length, fromDoc.length);
  let at = -1;
  for (let i = 0; i < len; i++) {
    if (fromEngine[i] !== fromDoc[i]) { at = i; break; }
  }
  fail(
    "engine.ts TINKU_CHARACTER and references/visual-dna.md quote have diverged.\n" +
      `  engine length: ${fromEngine.length}, doc length: ${fromDoc.length}\n` +
      (at >= 0
        ? `  first difference at char ${at}:\n` +
          `    engine: ${JSON.stringify(fromEngine.slice(at, at + 50))}\n` +
          `    doc:    ${JSON.stringify(fromDoc.slice(at, at + 50))}\n`
        : "") +
      "  Fix: edit the source of truth (engine.ts), then paste it verbatim into the\n" +
      "  references/visual-dna.md blockquote so the two match exactly."
  );
}

console.log(`✓ Tinku sync check passed (engine.ts ↔ visual-dna.md, ${fromEngine.length} chars identical)`);
