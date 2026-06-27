# npm / `npx` publishing (Phase 2) — design

- **Date:** 2026-06-27
- **Status:** Approved (design); pending spec review
- **Scope:** Make `doodleworks-mcp` installable and runnable as `npx doodleworks-mcp`, published to the public npm registry from CI with OIDC provenance, integrated into the existing release-please pipeline.
- **Builds on:** [`2026-06-24-release-and-branching-strategy-design.md`](2026-06-24-release-and-branching-strategy-design.md) (the release pipeline this extends).

## 1. Problem

The package is `"private": true` and runs only from a git clone via `tsx` (TypeScript executed directly; `tsconfig.server.json` is `emitDeclarationOnly: true`, so the build emits **no runnable JS**). There is no `bin`, no `files`, and the runtime resolves its assets from the dev layout. To let users add the server to an MCP host with `npx doodleworks-mcp`, the package must ship a self-contained, runnable JS artifact and publish to npm.

## 2. Goals / non-goals

**Goals**
- `npx doodleworks-mcp` boots the MCP server over **stdio** for a clean consumer with no clone, no build, no `tsx`.
- Published automatically from CI on each release-please release, with an **OIDC provenance attestation** and **no long-lived secret** in the repo.
- npm and GitHub versions stay aligned, starting at **1.0.0**.
- Run-from-source (`pnpm start`, `pnpm test`, `tsx main.ts`) keeps working unchanged for development.

**Non-goals**
- No scoped name (`@salzaki/…`) — the unscoped `doodleworks-mcp` is free and is used.
- No Docker, no bundler (esbuild/tsup) — plain `tsc` output.
- No change to the tools/engine/viewer behaviour; only packaging + the default transport.
- No `NPM_TOKEN` secret — OIDC trusted publishing only.

## 3. Decision summary

| Dimension | Decision |
|---|---|
| Packaging | Compile to JS with `tsc` (source already uses NodeNext `.js` imports). No `tsx` in production. |
| Entry | `bin: { "doodleworks-mcp": "dist/main.js" }`, shebang `#!/usr/bin/env node`. |
| Default transport | The published entry defaults to **stdio**; HTTP server moves behind `--http`. Host config is `{"command":"npx","args":["-y","doodleworks-mcp"]}`. |
| Runtime assets | Build assembles `dist/` as a self-contained tree (compiled JS + `mcp-app.html` + `references/`); runtime resolves assets co-located with the entry, with a dev-layout fallback. `files: ["dist"]`. |
| Auth | OIDC **trusted publishing** + `npm publish --provenance`; `permissions: id-token: write`. |
| Trigger | A `publish-npm` job in `release.yml`, gated on release-please's `release_created`; plus a one-time `workflow_dispatch` to bootstrap **1.0.0**. |
| First version | **1.0.0** via the manual dispatch, then every later release auto-publishes. |
| Name | `doodleworks-mcp` (unscoped, public, verified free on npm). |

## 4. Packaging approach — compile to JS

Change `tsconfig.server.json` to **emit JS** (drop `emitDeclarationOnly`; keep `outDir: ./dist`, `rootDir: "."`). `tsc -p tsconfig.server.json` then emits `dist/main.js`, `dist/server.js`, `dist/engine.js`, `dist/types.js` (plus `.d.ts`). The source already imports with NodeNext `.js` specifiers (`import { createServer } from "./server.js"`), so the compiled output resolves correctly under Node ESM with no rewrites.

`main.ts` gains a leading `#!/usr/bin/env node` shebang (TypeScript preserves a leading shebang in emit; `tsx` ignores it in dev). The published `bin` points at `dist/main.js`; npm marks it executable on install.

## 5. Runtime asset resolution (the load-bearing detail)

`server.ts` reads two asset trees at runtime, both relative to `MODULE_DIR = dirname(fileURLToPath(import.meta.url))`:
- the viewer bundle — `DIST_DIR/mcp-app.html` (`server.ts:628`),
- the planning resources — `REFERENCES_DIR/${doc}.md` (`server.ts:582`), i.e. the bundled `doc://doodleworks/*` resources.

In dev, `server.ts` sits at the repo root, so `MODULE_DIR/dist/mcp-app.html` and `MODULE_DIR/references/` resolve. In the compiled package, `server.js` sits in `dist/`, so those paths break (`dist/dist/…`, `dist/references` missing).

**Design:** make `dist/` a self-contained runtime tree and resolve assets against it.
1. Build outputs everything the runtime needs under `dist/`: compiled JS (tsc), the viewer (`vite` already writes `dist/mcp-app.html`), and a **copy of `references/` into `dist/references/`** (a new build step).
2. Introduce a single asset-base resolver used by `server.ts` (and the staleness check in `main.ts`) that picks the first existing candidate:
   - **packaged:** assets co-located with the compiled entry — `MODULE_DIR/mcp-app.html`, `MODULE_DIR/references/`;
   - **dev fallback:** the source layout — `MODULE_DIR/dist/mcp-app.html`, `MODULE_DIR/references/`.
   This keeps `tsx`-from-source and the installed package both working without branching on `NODE_ENV`.
3. `files: ["dist"]` ships exactly this tree. `references/` and `mcp-app.html` need not be listed separately because they are copied/emitted into `dist/`.

> The implementation plan owns the exact resolver signature and the copy mechanism (a small Node script or a `cpy`/`fs.cp` call in the build); the design fixes the contract: **assets live under `dist/` in the package and are resolved relative to the compiled entry.**

## 6. `package.json` changes

- `"private": false`.
- `"bin": { "doodleworks-mcp": "dist/main.js" }`.
- `"files": ["dist"]`.
- `"publishConfig": { "access": "public", "provenance": true }`.
- `"build"` script extended to copy `references/` into `dist/` after the JS + viewer build.
- `"start"` and any HTTP-dev invocation pass `--http` (see §7); `serve:stdio` stays (now the default mode, flag optional).
- `prepare` keeps `husky && pnpm run build` for local installs; the publish job builds explicitly and runs `npm publish --ignore-scripts` so packaging is deterministic in CI and `husky` never runs there.

## 7. Entry / default transport

`main.ts` currently starts the HTTP server unless `--stdio` is passed. For the published `bin`, invert the default:
- **no flag → stdio** (the host case `npx doodleworks-mcp`),
- **`--http` → the local Streamable HTTP server** (dev/testing),
- `--stdio` stays accepted (explicit, back-compatible).

`pnpm start` becomes `… tsx watch main.ts --http` so local dev keeps the HTTP server. This is the only runtime-behaviour change and it is confined to argument handling in `main()`.

## 8. Publish workflow

Extend `.github/workflows/release.yml` with a second job:

```
release-please:           # existing; expose outputs release_created, tag_name
publish-npm:
  needs: release-please
  if: needs.release-please.outputs.release_created == 'true'   # (or workflow_dispatch)
  permissions:
    id-token: write       # OIDC for trusted publishing + provenance
    contents: read
  steps:
    - checkout (the released tag)
    - pnpm install --frozen-lockfile
    - setup-node with registry-url https://registry.npmjs.org
    - upgrade npm to a version that supports OIDC trusted publishing
    - pnpm run build
    - npm pack + smoke test (see §10)
    - npm publish --provenance --access public --ignore-scripts
```

- **OIDC trusted publishing:** the repo + this workflow are registered as a trusted publisher on npmjs.com (user action, §11). No token is stored. `--provenance` records a signed attestation linking the tarball to this commit + workflow.
- **npm version:** trusted publishing/OIDC needs a recent npm; the job upgrades npm (`npm i -g npm@latest`) rather than relying on the bundled version. The plan pins the minimum.
- A `workflow_dispatch` trigger runs the same publish path for the one-time **1.0.0** bootstrap (§9).

## 9. First version — bootstrap 1.0.0

`v1.0.0` exists on GitHub but was tagged manually, so it never triggered a publish. To align npm at 1.0.0:
1. Land the publishing capability (§4–§8) as **non-releasing** commits (`build:` / `ci:` / `docs:`), so merging it does **not** open a release-please Release PR.
2. Run the publish job once via `workflow_dispatch` against the `v1.0.0` tag → publishes `doodleworks-mcp@1.0.0` with provenance, creating the npm package.
3. Every later release-please release auto-publishes its version.

This keeps the npm-enablement work from minting a stray version while still landing 1.0.0 on npm first.

## 10. Pre-publish verification

Before `npm publish`, the job builds a tarball and smoke-tests it so a broken package never ships:
- `npm pack` → install/run the tarball in a temp dir and assert `npx doodleworks-mcp` starts the stdio server and responds to an MCP `initialize` (or at minimum boots without the missing-bundle / missing-references errors).
- The existing `pnpm test` suite still runs in CI on the PR before merge.

## 11. Manual npm setup (user action — cannot be automated here)

1. Create an npm account (free; unscoped public package needs no paid plan).
2. Register a **trusted publisher** for `doodleworks-mcp`: owner `SalZaki`, repo `doodleworks-mcp`, workflow `release.yml` (npm supports pre-registering before the package exists, so the first OIDC publish creates it).
3. No secrets are added to the GitHub repo.

These steps are documented in `docs/RELEASING.md` (Phase 2 section is rewritten from "not yet enabled" to the live procedure).

## 12. Files changed / added

| Path | Change |
|---|---|
| `package.json` | `private:false`, `bin`, `files`, `publishConfig`, build/start script edits |
| `tsconfig.server.json` | emit JS (drop `emitDeclarationOnly`) |
| `main.ts` | shebang; default→stdio, `--http` for HTTP; use the asset resolver |
| `server.ts` | resolve viewer + `references/` via the shared asset resolver |
| build (script or `scripts/*.mjs`) | copy `references/` into `dist/` |
| `.github/workflows/release.yml` | add `publish-npm` job (OIDC + provenance + dispatch) |
| `docs/RELEASING.md` | rewrite Phase 2 into the live npm procedure + trusted-publisher setup |
| `README.md` | add the `npx` host-config snippet |

## 13. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Published tarball missing the viewer or `references/` → broken at runtime | §10 pack + `npx` smoke test gates the publish; `files: ["dist"]` after the copy step |
| Path resolver wrong in one of the two layouts | resolver tries packaged then dev candidates; smoke test runs the packaged layout, `pnpm test` runs the dev layout |
| OIDC/provenance needs a recent npm | job upgrades npm; plan pins the floor |
| A bad publish is permanent (npm) | smoke test + provenance + the one-time bootstrap is a deliberate manual dispatch, not automatic |
| Enablement work accidentally cuts a version | land it as `build:`/`ci:`/`docs:` (non-releasing per the hidden changelog-sections) |
| `husky`/`prepare` interfering during CI publish | build explicitly + `npm publish --ignore-scripts` |

## 14. Open questions

None blocking. The asset-resolver signature and the `references/`-copy mechanism are implementation details resolved in the plan; the design fixes the contract (assets under `dist/`, resolved relative to the compiled entry).
