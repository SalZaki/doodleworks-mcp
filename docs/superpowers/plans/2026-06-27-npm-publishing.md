# npm / `npx` Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `doodleworks-mcp` installable and runnable as `npx doodleworks-mcp` (stdio MCP server), published to npm from CI with OIDC provenance, bootstrapped at 1.0.0.

**Architecture:** Compile the TS server to runnable JS in `dist/` (which already holds the vite viewer bundle), copy `references/` into `dist/` so the package is self-contained, resolve runtime assets relative to the compiled entry with a dev-layout fallback, default the entry to stdio, and add a `publish-npm` job to `release.yml` using OIDC trusted publishing.

**Tech Stack:** TypeScript (NodeNext ESM), tsc, vite + vite-plugin-singlefile, pnpm 10, GitHub Actions, `googleapis/release-please-action@v4`, npm OIDC trusted publishing.

## Global Constraints

- Node `>=22`; CI matrix Node `22` + `24`; package manager `pnpm@10.34.3` (`corepack enable`).
- ESM only (`"type": "module"`); source uses NodeNext `.js` import specifiers — keep them.
- Package name `doodleworks-mcp` (unscoped, public, verified free on npm). Tags `vX.Y.Z`.
- Releases fire ONLY for `feat`/`fix`/`perf`/`revert` (docs/deps/chore/ci/build/test/refactor/style are hidden, non-releasing). **Land this work as `build:`/`ci:`/`docs:` so merging it does NOT cut a release.**
- The Tinku sync gate (`pnpm run check:tinku`) must stay green; do not edit `engine.ts`/`references/visual-dna.md`.
- Branch protection on `main`: required checks `build-and-test (22)`, `build-and-test (24)`, `validate`; merge with `gh pr merge --admin` (self-review).
- `gh` host quirk: API calls use `GH_HOST=github.com gh api --hostname github.com …`; other `gh` commands prefixed `GH_HOST=github.com`.
- Repo `SalZaki/doodleworks-mcp`; work branch `feat/npm-publishing` (already created from `origin/main`).
- An npm publish is PERMANENT. Tasks 9–10 are outward-facing and require explicit maintainer confirmation.

---

## Task 1: Compile to a runnable, self-contained `dist/`

Make the build emit runnable JS and bundle the runtime assets (`references/`) alongside the viewer.

**Files:**
- Modify: `tsconfig.server.json`
- Create: `scripts/copy-runtime-assets.mjs`
- Modify: `package.json` (`scripts.build`)

**Interfaces:**
- Produces: `pnpm build` yields `dist/main.js`, `dist/server.js`, `dist/engine.js`, `dist/types.js`, `dist/mcp-app.html`, and `dist/references/*.md`. Later tasks rely on `dist/main.js` (the bin) and on assets being co-located in `dist/`.

- [ ] **Step 1: Make `tsc` emit JS** — edit `tsconfig.server.json`, removing `"emitDeclarationOnly": true` and disabling declarations (this is a runnable CLI, not a typed library):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": false,
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["server.ts", "main.ts", "engine.ts", "types.ts"]
}
```

- [ ] **Step 2: Create the asset-copy script** — `scripts/copy-runtime-assets.mjs`:

```js
// Copies runtime-only asset trees into dist/ so the published package is
// self-contained. The server reads references/*.md at runtime (the bundled
// doc://doodleworks/* resources); in the packaged layout the compiled entry
// lives in dist/, so the references must live in dist/ too.
// MUST run AFTER `vite build` (vite empties dist/) and after the tsc emit.
import { cpSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(new URL("..", import.meta.url)));
const from = path.join(root, "references");
const to = path.join(root, "dist", "references");

if (!existsSync(from)) {
  console.error(`[copy-runtime-assets] missing source dir: ${from}`);
  process.exit(1);
}
cpSync(from, to, { recursive: true });
console.log(`[copy-runtime-assets] copied references/ -> dist/references/`);
```

- [ ] **Step 3: Reorder the build so vite runs before the JS emit** — in `package.json`, replace the `build` script. vite's `emptyOutDir: true` wipes `dist/`, so vite must run BEFORE `tsc` emits JS, then assets are copied last:

```json
"build": "pnpm run check:tinku && tsc --noEmit && cross-env INPUT=mcp-app.html vite build && tsc -p tsconfig.server.json && node scripts/copy-runtime-assets.mjs",
```

- [ ] **Step 4: Build and verify the dist tree** —

Run:
```bash
pnpm build && node -e "const fs=require('fs'); for (const f of ['dist/main.js','dist/server.js','dist/engine.js','dist/types.js','dist/mcp-app.html','dist/references/visual-dna.md','dist/references/intake.md']) { if(!fs.existsSync(f)) throw new Error('missing '+f); } console.log('dist tree OK');"
```
Expected: build completes (Tinku check passes, vite builds, tsc emits) and prints `dist tree OK`.

- [ ] **Step 5: Verify the compiled entry parses as ESM** —

Run: `node --check dist/main.js && echo "main.js parses"`
Expected: `main.js parses` (no syntax errors).

- [ ] **Step 6: Commit**

```bash
git add tsconfig.server.json scripts/copy-runtime-assets.mjs package.json
git commit -m "build: emit runnable JS and bundle references into dist"
```

---

## Task 2: Shared asset resolver (`paths.ts`)

Resolve the viewer bundle and references dir correctly in BOTH the packaged layout (entry in `dist/`) and run-from-source (`tsx`, entry at repo root).

**Files:**
- Create: `paths.ts`
- Modify: `server.ts:51-53` and `server.ts:628`
- Modify: `main.ts` (the `warnIfViewerStale` bundle path)
- Test: `test/paths.test.ts`

**Interfaces:**
- Produces: `paths.ts` exports `VIEWER_BUNDLE: string` (absolute path to the built `mcp-app.html`) and `REFERENCES_DIR: string` (absolute path to the references dir). `server.ts` and `main.ts` consume these.

- [ ] **Step 1: Write the failing test** — `test/paths.test.ts` (run-from-source layout: this file runs via `tsx` from the repo root, so the resolver must point at `dist/mcp-app.html` and `references/`):

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm build && node --import tsx --test test/paths.test.ts`
Expected: FAIL — module resolution error for `../paths.js` (paths.ts doesn't exist yet).

- [ ] **Step 3: Create `paths.ts`** —

```ts
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
```

(No `tsconfig` `include` change is needed: `server.ts`/`main.ts` import `./paths.js`, so tsc compiles `paths.ts` → `dist/paths.js` as part of the import graph, and `typecheck:test` reaches it the same way.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test test/paths.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Wire `server.ts` to the resolver** — replace the local asset-path constants at `server.ts:51-53`:

```ts
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(MODULE_DIR, "dist");
const REFERENCES_DIR = path.join(MODULE_DIR, "references");
```

with an import (place it with the other imports near the top, and delete the now-unused `fileURLToPath` import on line 25 if nothing else uses it — check with `grep -n fileURLToPath server.ts`):

```ts
import { REFERENCES_DIR, VIEWER_BUNDLE } from "./paths.js";
```

Then at `server.ts:628`, replace:

```ts
const file = path.join(DIST_DIR, "mcp-app.html");
```

with:

```ts
const file = VIEWER_BUNDLE;
```

(The `REFERENCES_DIR` use at `server.ts:582` — `path.join(REFERENCES_DIR, \`${doc.name}.md\`)` — now reads the imported constant unchanged.)

- [ ] **Step 6: Wire `main.ts` staleness check to the resolver** — in `main.ts`, change the bundle path in `warnIfViewerStale` from:

```ts
const bundle = path.join(MODULE_DIR, "dist", "mcp-app.html");
```

to import and use the shared constant. Add to the imports:

```ts
import { VIEWER_BUNDLE } from "./paths.js";
```

and replace the `bundle` line with:

```ts
const bundle = VIEWER_BUNDLE;
```

- [ ] **Step 7: Verify dev tests still pass and the build still works**

Run: `pnpm test && pnpm build`
Expected: all tests pass (including `paths.test.ts`), build succeeds.

- [ ] **Step 8: Commit**

```bash
git add paths.ts server.ts main.ts test/paths.test.ts
git commit -m "build: resolve viewer + references via a layout-aware path module"
```

---

## Task 3: `bin` entry, shebang, and stdio-by-default

Make the compiled entry an executable that defaults to stdio (the host case), with `--http` for the local server.

**Files:**
- Modify: `main.ts` (shebang + arg handling)
- Modify: `package.json` (`bin`, `scripts.start`)

**Interfaces:**
- Consumes: `dist/main.js` from Task 1.
- Produces: `bin: { "doodleworks-mcp": "dist/main.js" }`; `node dist/main.js` → stdio server; `node dist/main.js --http` → HTTP server.

- [ ] **Step 1: Add the shebang** — make line 1 of `main.ts` exactly:

```ts
#!/usr/bin/env node
```

(Keep the existing file comment block immediately after. `main.ts` is imported nowhere — verified — so the shebang only affects direct execution; `tsx`/Node strip it on the entry.)

- [ ] **Step 2: Flip the default transport to stdio** — replace the `main()` body in `main.ts`:

```ts
async function main() {
  await warnIfViewerStale();
  if (process.argv.includes("--stdio")) {
    await startStdioServer(createServer);
  } else {
    await startStreamableHTTPServer(createServer);
  }
}
```

with (default stdio; `--http` opts into the local server; `--stdio` still accepted):

```ts
async function main() {
  if (process.argv.includes("--http")) {
    await warnIfViewerStale();
    await startStreamableHTTPServer(createServer);
  } else {
    await startStdioServer(createServer);
  }
}
```

(The staleness warning is a dev aid for the HTTP/viewer flow, so it now runs only in `--http` mode — it never prints over the stdio JSON-RPC channel.)

- [ ] **Step 3: Add `bin` and update `start`** — in `package.json`, add the `bin` field and make `start` pass `--http`:

```json
"bin": { "doodleworks-mcp": "dist/main.js" },
```
```json
"start": "concurrently --raw \"cross-env NODE_ENV=development INPUT=mcp-app.html vite build --watch\" \"tsx watch main.ts --http\"",
```

- [ ] **Step 4: Verify the compiled bin defaults to stdio and speaks MCP** —

Run (sends an MCP `initialize` over stdio and checks for a JSON-RPC response):
```bash
pnpm build
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' | node dist/main.js | head -c 400
echo
```
Expected: a JSON-RPC response line containing `"result"` and `"serverInfo"` (the server responded over stdio — no HTTP banner, no flag needed).

- [ ] **Step 5: Verify `--http` still starts the HTTP server** —

Run:
```bash
node dist/main.js --http &
SVR=$!; sleep 1
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/mcp -X POST -H 'content-type: application/json' -d '{}' ; echo
kill $SVR 2>/dev/null
```
Expected: an HTTP status code is printed (e.g. `400`/`406`/`200` — any HTTP response proves the server bound), and the process is killed.

- [ ] **Step 6: Commit**

```bash
git add main.ts package.json
git commit -m "build: ship an executable bin that defaults to stdio (--http for the local server)"
```

---

## Task 4: npm publish metadata

Mark the package publishable and constrain the tarball to the runtime tree.

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: a package that `npm pack` builds with only `dist/**` (+ standard manifest files), `private: false`, provenance-on.

- [ ] **Step 1: Edit `package.json`** — set `"private": false` and add:

```json
"files": ["dist"],
"publishConfig": { "access": "public", "provenance": true },
```

(Place `files` and `publishConfig` as top-level keys. Leave `name`, `version` `1.0.0`, `bin`, `engines`, `type` as-is.)

- [ ] **Step 2: Verify the tarball contents** —

Run:
```bash
pnpm build
npm pack --dry-run --json 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const files=JSON.parse(s)[0].files.map(f=>f.path); const hasMain=files.includes('dist/main.js'); const hasViewer=files.includes('dist/mcp-app.html'); const hasRefs=files.some(f=>f.startsWith('dist/references/')); const noSrc=!files.some(f=>f==='server.ts'||f==='main.ts'||f.startsWith('test/')); if(!(hasMain&&hasViewer&&hasRefs&&noSrc)) throw new Error('tarball wrong: '+JSON.stringify({hasMain,hasViewer,hasRefs,noSrc})); console.log('tarball OK — dist only, includes bin+viewer+references');});"
```
Expected: `tarball OK — dist only, includes bin+viewer+references`.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "build: make the package publishable (private:false, files, provenance)"
```

---

## Task 5: Packaged-tarball smoke test

A repeatable check that the *packed* tarball (not the source tree) installs and runs `npx doodleworks-mcp` over stdio — catches missing assets before any publish.

**Files:**
- Create: `scripts/smoke-pack.mjs`

**Interfaces:**
- Consumes: the build + `bin` from Tasks 1–4.
- Produces: `node scripts/smoke-pack.mjs` exits 0 iff the packed tarball boots the stdio server and answers an MCP `initialize`. Reused by CI (Task 6).

- [ ] **Step 1: Write the smoke script** — `scripts/smoke-pack.mjs`:

```js
// Packs the real tarball, installs it into a temp dir, runs the published bin
// over stdio, and asserts it answers an MCP initialize. Proves the packaged
// layout (compiled JS + co-located viewer + references) actually runs.
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const repo = process.cwd();
const tar = execFileSync("npm", ["pack", "--silent"], { cwd: repo }).toString().trim().split("\n").pop();
const dir = mkdtempSync(path.join(tmpdir(), "dw-smoke-"));
writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "smoke", private: true }));
execFileSync("npm", ["install", "--no-save", path.join(repo, tar)], { cwd: dir, stdio: "inherit" });

const bin = path.join(dir, "node_modules", ".bin", "doodleworks-mcp");
const child = spawn(bin, [], { cwd: dir });
let out = "";
child.stdout.on("data", (d) => (out += d));
child.stderr.on("data", (d) => process.stderr.write(d));
child.stdin.write(
  JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "0" } } }) + "\n",
);

const timer = setTimeout(() => { child.kill(); fail("no response within 10s"); }, 10_000);
function fail(m) { console.error(`SMOKE FAIL: ${m}`); process.exit(1); }
child.stdout.on("data", () => {
  if (out.includes('"result"') && out.includes("serverInfo")) {
    clearTimeout(timer); child.kill();
    console.log("SMOKE OK: packaged npx server answered initialize");
    process.exit(0);
  }
});
child.on("exit", (code) => { clearTimeout(timer); fail(`bin exited early (code ${code})`); });
```

- [ ] **Step 2: Run the smoke test**

Run: `pnpm build && node scripts/smoke-pack.mjs`
Expected: `SMOKE OK: packaged npx server answered initialize` (exit 0). Clean up stray tarballs: `rm -f doodleworks-mcp-*.tgz`.

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke-pack.mjs
git commit -m "build: add a packaged-tarball npx smoke test"
```

---

## Task 6: `publish-npm` job in the release workflow

Publish to npm from CI with OIDC provenance, gated on a real release-please release, plus a manual `workflow_dispatch` for the 1.0.0 bootstrap.

**Files:**
- Modify: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: the buildable, packable package (Tasks 1–5).
- Produces: on `release_created` (or manual dispatch), CI builds, smoke-tests, and runs `npm publish --provenance`.

- [ ] **Step 1: Rewrite `.github/workflows/release.yml`** — add `workflow_dispatch`, expose release-please outputs, and add the publish job:

```yaml
name: release

# release-please opens/updates a Release PR; merging it creates the tag +
# GitHub Release, which triggers publish-npm. The workflow_dispatch path runs
# publish-npm directly for the one-time v1.0.0 bootstrap.
on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      publish_ref:
        description: "git ref/tag to build and publish (e.g. v1.0.0)"
        required: true
        default: "v1.0.0"

permissions:
  contents: write
  pull-requests: write

concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false

jobs:
  release-please:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    outputs:
      release_created: ${{ steps.rp.outputs.release_created }}
      tag_name: ${{ steps.rp.outputs.tag_name }}
    steps:
      - id: rp
        uses: googleapis/release-please-action@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

  publish-npm:
    needs: release-please
    # Run after a real release, OR on a manual dispatch (the 1.0.0 bootstrap).
    if: ${{ always() && (needs.release-please.outputs.release_created == 'true' || github.event_name == 'workflow_dispatch') }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write   # OIDC for npm trusted publishing + provenance
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event_name == 'workflow_dispatch' && inputs.publish_ref || needs.release-please.outputs.tag_name }}
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          registry-url: "https://registry.npmjs.org"
          cache: pnpm
      - name: Upgrade npm (OIDC trusted publishing needs a recent npm)
        run: npm install -g npm@latest
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build
      - name: Smoke-test the packed tarball
        run: node scripts/smoke-pack.mjs
      - name: Publish to npm with provenance
        run: npm publish --provenance --access public --ignore-scripts
```

- [ ] **Step 2: Lint the workflow**

Run: `command -v actionlint >/dev/null 2>&1 || brew install actionlint; actionlint .github/workflows/release.yml`
Expected: exit 0, no output.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: publish to npm with OIDC provenance on release (+ dispatch bootstrap)"
```

---

## Task 7: Docs — README `npx` snippet + RELEASING Phase-2 rewrite

**Files:**
- Modify: `README.md`
- Modify: `docs/RELEASING.md`

**Interfaces:**
- Produces: a copy-paste host-config block and the live npm release procedure.

- [ ] **Step 1: Add the `npx` host-config block to `README.md`** — under the install/setup section (place near the existing host-setup content; match surrounding heading style), add:

````markdown
### Install via npx (no clone)

Add to your MCP host config (e.g. Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "doodleworks": {
      "command": "npx",
      "args": ["-y", "doodleworks-mcp"],
      "env": { "OPENAI_API_KEY": "sk-..." }
    }
  }
}
```

`npx` fetches the published package and runs the stdio server — no clone, no build. Provide `OPENAI_API_KEY` or `GEMINI_API_KEY` to render illustrations.
````

- [ ] **Step 2: Rewrite the Phase 2 section of `docs/RELEASING.md`** — replace the existing `## Phase 2 — npm / npx (not yet enabled)` block with:

```markdown
## npm / npx publishing

Published to npm automatically on each release via the `publish-npm` job in
`release.yml`, using **OIDC trusted publishing** (no stored token) with a
provenance attestation. Consumers run `npx doodleworks-mcp`.

**One-time setup (npmjs.com):** register a *trusted publisher* for the
`doodleworks-mcp` package — owner `SalZaki`, repo `doodleworks-mcp`, workflow
`release.yml`. npm allows pre-registering before the package exists, so the
first publish creates it.

**How a version reaches npm:** merging a release-please Release PR creates the
GitHub Release (`release_created`), which runs `publish-npm` → build →
packaged-tarball smoke test → `npm publish --provenance`.

**Bootstrap (one time):** 1.0.0 was published via the workflow's
`workflow_dispatch` (input `publish_ref: v1.0.0`), since the v1.0.0 tag predates
the publish job.
```

- [ ] **Step 3: Verify docs reference real values**

Run:
```bash
grep -q "npx" README.md && echo "README npx OK"
grep -q "trusted publisher" docs/RELEASING.md && echo "RELEASING setup OK"
grep -q "not yet enabled" docs/RELEASING.md && echo "STALE phrase remains" || echo "phase-2 rewritten OK"
```
Expected: `README npx OK`, `RELEASING setup OK`, `phase-2 rewritten OK`.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/RELEASING.md
git commit -m "docs: document npx install and the npm publishing procedure"
```

---

## Task 8: Land the PR (non-releasing)

**Files:** none (operational).

**Interfaces:**
- Consumes: Tasks 1–7 on `feat/npm-publishing`.
- Produces: the publishing capability on `main`, WITHOUT cutting a release (all commits are `build:`/`ci:`/`docs:`).

- [ ] **Step 1: Push + open the PR** (use a `build:` title so the merge does not trigger release-please)

Run:
```bash
git push -u origin feat/npm-publishing
GH_HOST=github.com gh pr create --repo SalZaki/doodleworks-mcp --base main --head feat/npm-publishing \
  --title "build: make the server npx-installable (npm publishing pipeline)" \
  --body "Implements docs/superpowers/specs/2026-06-27-npm-publishing-design.md: tsc-compiled runnable dist/, self-contained assets, stdio-default bin, OIDC publish job, docs. Non-releasing (build/ci/docs). First publish (v1.0.0) is a follow-up workflow_dispatch after the trusted publisher is registered."
```
Expected: PR URL printed.

- [ ] **Step 2: Confirm CI is green and merge**

Run:
```bash
GH_HOST=github.com gh pr checks --watch
GH_HOST=github.com gh pr merge --squash --admin --delete-branch
```
Expected: `build-and-test (22)`, `build-and-test (24)`, `validate` pass; PR merged; branch deleted.

- [ ] **Step 3: Confirm no Release PR was opened** (build/ci/docs are non-releasing)

Run: `GH_HOST=github.com gh pr list --repo SalZaki/doodleworks-mcp --state open --json number --jq 'length'`
Expected: `0`.

---

## Task 9: ⚠️ OUTWARD-FACING — Register trusted publisher + bootstrap-publish 1.0.0

> **Confirm with the maintainer before running.** This publishes `doodleworks-mcp@1.0.0` to the public npm registry — permanent and unconditionally visible.

**Files:** none (operational).

**Interfaces:**
- Consumes: the merged publish job + the `v1.0.0` tag.
- Produces: `doodleworks-mcp@1.0.0` live on npm with provenance.

- [ ] **Step 1: Maintainer registers the trusted publisher** on npmjs.com for package `doodleworks-mcp`: owner `SalZaki`, repository `doodleworks-mcp`, workflow filename `release.yml`. (Pre-registration is allowed for a not-yet-existing package.) Confirm done before proceeding.

- [ ] **Step 2: Trigger the bootstrap publish** —

Run:
```bash
GH_HOST=github.com gh workflow run release.yml --repo SalZaki/doodleworks-mcp -f publish_ref=v1.0.0
```
Expected: workflow dispatched.

- [ ] **Step 3: Watch the run to success** —

Run:
```bash
sleep 10
RUNID=$(GH_HOST=github.com gh run list --repo SalZaki/doodleworks-mcp --workflow=release.yml --event=workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId')
GH_HOST=github.com gh run watch "$RUNID" --repo SalZaki/doodleworks-mcp --interval 15 || GH_HOST=github.com gh run view "$RUNID" --repo SalZaki/doodleworks-mcp
```
Expected: the `publish-npm` job (build → smoke → publish) concludes success.

- [ ] **Step 4: Verify on npm** —

Run: `npm view doodleworks-mcp version dist.tarball`
Expected: `1.0.0` and a registry tarball URL (the package exists publicly).

---

## Task 10: Verify `npx` end-to-end for a clean consumer

**Files:** none (operational).

- [ ] **Step 1: Run the published package over stdio from a clean temp dir** —

Run:
```bash
cd "$(mktemp -d)"
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' | npx -y doodleworks-mcp@1.0.0 | head -c 400; echo
```
Expected: a JSON-RPC response containing `"result"` and `"serverInfo"` — `npx doodleworks-mcp` works for a fresh user with no clone.

- [ ] **Step 2: Confirm provenance is attached** —

Run: `npm view doodleworks-mcp dist.attestations`
Expected: a non-empty attestations object (provenance recorded).

---

## Done criteria

- `pnpm build` emits a self-contained `dist/` (compiled JS + viewer + references); `pnpm test` green in the dev layout.
- The packaged-tarball smoke test passes (`scripts/smoke-pack.mjs`).
- `doodleworks-mcp@1.0.0` is live on npm with provenance; `npx -y doodleworks-mcp` boots the stdio server for a clean consumer.
- Future release-please releases auto-publish their version via `publish-npm`.
- `README.md` shows the `npx` host config; `docs/RELEASING.md` documents the npm procedure + trusted-publisher setup.
- No stray release was cut by landing this work (it merged as `build:`).
