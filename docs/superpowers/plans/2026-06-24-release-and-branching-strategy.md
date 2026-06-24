# Release & Branching Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `doodleworks-mcp` a trunk-based, automated test-and-release pipeline: CI as the required test gate, `release-please` as the reviewable release gate (tag + GitHub Release from conventional commits), bootstrapped at a real `v1.0.0`, with a documented path to `npx` distribution.

**Architecture:** Keep `main` as the only long-lived branch. Add three GitHub Actions / config artifacts — a `release-please` workflow + its two config files, and a conventional-commit PR-title linter. Reconcile the changelog for a clean `1.0.0`, harden `main` with branch protection, then cut the bootstrap release. No application code changes.

**Tech Stack:** GitHub Actions, `googleapis/release-please-action@v4` (manifest mode, `release-type: node`), `amannn/action-semantic-pull-request@v5`, `gh` CLI, Node 22+/pnpm 10.

## Global Constraints

- **Runtime floor:** Node `>=22`; CI matrix is Node `22` and `24` (job id `build-and-test`).
- **Package manager:** `pnpm@10.34.3` (pinned in `package.json` `packageManager`; lockfile `lockfileVersion: 9.0`); use `corepack enable`.
- **Commit/PR titles:** Conventional Commits. Because PRs are **squash-merged**, the **PR title** is the commit subject `release-please` parses. Valid types: `feat`, `fix`, `perf`, `docs`, `chore`, `ci`, `build`, `test`, `refactor`, `style`, `revert`.
- **Versioning:** SemVer; `CHANGELOG.md` follows Keep-a-Changelog for the historical `1.0.0` entry, then `release-please`-managed format thereafter.
- **Package stays `"private": true`** for this plan (phase 1). No npm publish.
- **The Tinku sync gate must stay green:** `pnpm run build` runs `pnpm run check:tinku`; do not touch `engine.ts`/`references/visual-dna.md`.
- **Build/test commands:** `pnpm build` (type-check + viewer bundle + Tinku gate), `pnpm test` (type-check tests + `node --test`).
- **`gh` host quirk:** the default `gh` host token is invalid in this environment. For API calls use `GH_HOST=github.com gh api --hostname github.com ...`; prefix other `gh` commands with `GH_HOST=github.com`.
- **Repo:** `SalZaki/doodleworks-mcp`; default branch `main`; work branch `SalZaki/test-release-branch-strategy`.
- **Tag format:** plain `vX.Y.Z` (single package; `include-component-in-tag: false`).

---

## Task 1: release-please configuration files

Create the manifest config and the version baseline that anchor `release-please` to the current `v1.0.0`.

**Files:**
- Create: `release-please-config.json`
- Create: `.release-please-manifest.json`

**Interfaces:**
- Produces: a `release-type: node`, single-root-package (`.`) manifest config with `include-component-in-tag: false` and explicit `changelog-sections`; a manifest pinning `"."` to `"1.0.0"`. Task 2's workflow consumes these by their default filenames.

- [ ] **Step 1: Write `release-please-config.json`**

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "release-type": "node",
  "include-component-in-tag": false,
  "tag-separator": "-",
  "changelog-sections": [
    { "type": "feat", "section": "Features" },
    { "type": "fix", "section": "Bug Fixes" },
    { "type": "perf", "section": "Performance Improvements" },
    { "type": "revert", "section": "Reverts" },
    { "type": "docs", "section": "Documentation" },
    { "type": "deps", "section": "Dependencies" },
    { "type": "chore", "section": "Miscellaneous", "hidden": true },
    { "type": "ci", "section": "Continuous Integration", "hidden": true },
    { "type": "build", "section": "Build System", "hidden": true },
    { "type": "test", "section": "Tests", "hidden": true },
    { "type": "refactor", "section": "Code Refactoring", "hidden": true },
    { "type": "style", "section": "Styles", "hidden": true }
  ],
  "packages": {
    ".": {}
  }
}
```

- [ ] **Step 2: Write `.release-please-manifest.json`**

```json
{
  ".": "1.0.0"
}
```

- [ ] **Step 3: Verify both files are valid JSON with the expected shape**

Run:
```bash
node -e "const c=require('./release-please-config.json'); const m=require('./.release-please-manifest.json'); if(c['release-type']!=='node') throw new Error('release-type'); if(c['include-component-in-tag']!==false) throw new Error('component flag'); if(!c.packages['.']) throw new Error('root package'); if(m['.']!=='1.0.0') throw new Error('manifest baseline'); console.log('config + manifest OK');"
```
Expected: `config + manifest OK`

- [ ] **Step 4: Commit**

```bash
git add release-please-config.json .release-please-manifest.json
git commit -m "ci: add release-please config and version manifest"
```

---

## Task 2: release-please workflow

Add the workflow that opens/updates the Release PR and, on its merge, creates the tag + GitHub Release.

**Files:**
- Create: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: `release-please-config.json` and `.release-please-manifest.json` from Task 1 (via the action's default file paths).
- Produces: a `release` workflow on `push` to `main` with `contents: write` + `pull-requests: write`.

- [ ] **Step 1: Write `.github/workflows/release.yml`**

```yaml
name: release

# release-please watches main, opens/updates a "Release PR" as conventional
# commits land, and — when that PR is merged — creates the vX.Y.Z tag and the
# GitHub Release. Note: the Release PR is created with the default GITHUB_TOKEN,
# so it intentionally does NOT re-run the CI workflow (every constituent change
# already passed CI before merging to main). See the release strategy spec, §9.

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          # config-file / manifest-file default to
          # release-please-config.json and .release-please-manifest.json
```

- [ ] **Step 2: Install actionlint if absent**

Run:
```bash
command -v actionlint >/dev/null 2>&1 || brew install actionlint
```
Expected: `actionlint` is on PATH (no error).

- [ ] **Step 3: Verify the workflow lints clean**

Run: `actionlint .github/workflows/release.yml`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add release-please release workflow"
```

---

## Task 3: PR-title conventional-commit linter

Guard the squash-merge subject so `release-please` always parses a valid type.

**Files:**
- Create: `.github/workflows/pr-title-lint.yml`

**Interfaces:**
- Produces: a `pr-title-lint` workflow whose job id is `validate` (this exact name becomes the required status-check context in Task 8).

- [ ] **Step 1: Write `.github/workflows/pr-title-lint.yml`**

```yaml
name: pr-title-lint

# Validates the PR *title* against Conventional Commits. Because PRs are
# squash-merged, the title becomes the commit subject that release-please reads,
# so a malformed title would silently mis-compute the next version.
# Uses pull_request_target (no checkout of PR code) so it has the token it needs
# and works for fork PRs; the job's pass/fail is the required status check.

on:
  pull_request_target:
    types: [opened, edited, synchronize, reopened]

permissions:
  pull-requests: read

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: amannn/action-semantic-pull-request@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          types: |
            feat
            fix
            perf
            docs
            chore
            ci
            build
            test
            refactor
            style
            revert
```

- [ ] **Step 2: Verify the workflow lints clean**

Run: `actionlint .github/workflows/pr-title-lint.yml`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/pr-title-lint.yml
git commit -m "ci: lint PR titles against Conventional Commits"
```

---

## Task 4: CHANGELOG bootstrap reconciliation

Fold the current `[Unreleased]` items into a single, dated `1.0.0` so the first tagged release describes the full first public release. (Decision from spec §7: bootstrap version is `v1.0.0`.)

**Files:**
- Modify: `CHANGELOG.md`

**Interfaces:**
- Produces: a `CHANGELOG.md` whose top released entry is `## [1.0.0] - 2026-06-24`, no `[Unreleased]` section. `release-please` will prepend future versions above this entry.

- [ ] **Step 1: Replace the body of `CHANGELOG.md`**

Replace everything from the `## [Unreleased]` heading through the end of the `## [1.0.0]` block with this single reconciled entry (keep the file's existing top matter — the title and the "based on Keep a Changelog / SemVer" paragraph — unchanged):

```markdown
## [1.0.0] - 2026-06-24

First public open-source release.

### Added
- `create_illustrations`, `regenerate_illustration`, and `get_illustration`
  tools; the `plan_illustrations` prompt; bundled `doc://doodleworks/*`
  planning resources; the in-host viewer with prev/next, regenerate, and
  download; OpenAI / Gemini bring-your-own-key rendering; and the extensible
  style-reference library.
- Open-source scaffolding: `LICENSE` (MIT), `.gitignore`, `.env.example`,
  `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, GitHub issue/PR
  templates, and a CI workflow (build + test on Node 22 and 24).
- `package.json` metadata (`license`, `author`, `repository`, `bugs`,
  `homepage`, `keywords`, `engines`, `packageManager`).
- Per-set cap on the number of illustrations to guard against unbounded paid
  image renders.
- Stale-viewer guard: a `VIEWER_CONTRACT_VERSION` handshake so the viewer reports
  a version skew precisely (instead of a generic error), a clear "run
  `pnpm run build`" error when the viewer bundle is missing, and a `prepare`
  script so `pnpm install` always builds the viewer.

### Changed
- Pinned the previously wildcard (`*`) runtime dependencies to known-good
  versions for reproducible installs.
- Stopped tracking `node_modules/`, `dist/`, and `.DS_Store` in git.
```

- [ ] **Step 2: Verify there is no leftover `[Unreleased]` section and the date is present**

Run:
```bash
grep -q "## \[Unreleased\]" CHANGELOG.md && echo "FAIL: Unreleased still present" || echo "OK: no Unreleased"
grep -q "## \[1.0.0\] - 2026-06-24" CHANGELOG.md && echo "OK: dated 1.0.0 present" || echo "FAIL: dated 1.0.0 missing"
```
Expected: `OK: no Unreleased` and `OK: dated 1.0.0 present`

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: reconcile CHANGELOG into a dated 1.0.0 for the bootstrap release"
```

---

## Task 5: Contributor + maintainer documentation

Document the conventional-PR-title rule and the release flow, and fix stale version facts in `CONTRIBUTING.md`.

**Files:**
- Modify: `CONTRIBUTING.md`
- Create: `docs/RELEASING.md`

**Interfaces:**
- Produces: contributor-facing rules (PR-title grammar, the Release-PR flow) and a maintainer runbook for cutting releases and the future phase-2 npm publish.

- [ ] **Step 1: Fix the stale CI line in `CONTRIBUTING.md`**

Find this line (currently in the "Pull requests" section):

```markdown
3. **`pnpm build` and `pnpm test` must pass** before you open the PR — CI runs
   both on Node 18, 20, and 22.
```

Replace with:

```markdown
3. **`pnpm build` and `pnpm test` must pass** before you open the PR — CI runs
   both on Node 22 and 24, and both are required status checks on `main`.
```

- [ ] **Step 2: Append a "Conventional commits & releases" section to `CONTRIBUTING.md`**

Append at the end of the file (before the licensing sign-off paragraph if present, otherwise at the very end):

```markdown
## Conventional commits & releases

Commits and **pull-request titles** follow [Conventional Commits](https://www.conventionalcommits.org/).
Because PRs are **squash-merged**, the PR title becomes the commit subject — and
that subject drives both the changelog and the next version number. A
`pr-title-lint` check enforces this on every PR.

Allowed types: `feat`, `fix`, `perf`, `docs`, `chore`, `ci`, `build`, `test`,
`refactor`, `style`, `revert`. `feat:` triggers a minor bump, `fix:`/`perf:` a
patch; add `!` (e.g. `feat!:`) or a `BREAKING CHANGE:` footer for a major bump.

Releases are automated by [release-please](https://github.com/googleapis/release-please).
As typed commits land on `main`, release-please opens a **"Release PR"** that
bumps the version and updates `CHANGELOG.md`. Merging that PR cuts the release:
it tags `vX.Y.Z` and publishes a GitHub Release. Maintainers: see
[`docs/RELEASING.md`](docs/RELEASING.md).
```

- [ ] **Step 3: Create `docs/RELEASING.md`**

```markdown
# Releasing

`doodleworks-mcp` uses trunk-based development with automated, tag-driven
releases. There are no long-lived `test`/`develop`/`release` branches.

## How a release happens

1. Feature/fix PRs merge into `main` with Conventional Commit titles. CI
   (build + test on Node 22 and 24) is a required check on every PR.
2. [release-please](https://github.com/googleapis/release-please) watches `main`
   and maintains a **Release PR** titled `chore(main): release X.Y.Z`, with the
   computed version bump and the generated `CHANGELOG.md` entry.
3. Review the Release PR's changelog. When it looks right, **merge it**.
4. On merge, release-please creates the `vX.Y.Z` tag and the GitHub Release.

> The Release PR is created with the default `GITHUB_TOKEN`, so it does **not**
> re-run CI (GitHub blocks token-created PRs from triggering workflows). That is
> intentional: every change in the release already passed CI before it merged to
> `main`. As a repo admin you can merge the Release PR despite the "no checks"
> state.

## Versioning

Semantic Versioning, derived from commit types since the last `vX.Y.Z` tag:
`feat:` → minor, `fix:`/`perf:` → patch, `feat!:` / `BREAKING CHANGE:` → major.

## Bootstrap (one time)

The baseline `v1.0.0` tag + GitHub Release were created from `main` at the first
public release. release-please computes every later version from commits after
that tag.

## Phase 2 — npm / npx (not yet enabled)

To ship `npx doodleworks-mcp` later:

1. Set `"private": false`; add `"bin"` and `"files"` (include built `dist/`);
   confirm `prepare`/`prepublishOnly` builds the viewer bundle so the published
   tarball is runnable.
2. Add an npm publish step to `release.yml`, gated on the action's
   `release_created` output, using OIDC + `npm publish --provenance`
   (`permissions: id-token: write`), npm >= 9.5.
3. Verify `npx doodleworks-mcp` boots the server for a clean consumer before
   announcing it.
```

- [ ] **Step 4: Verify the docs reference real files and have no leftover stale versions**

Run:
```bash
test -f docs/RELEASING.md && echo "OK: RELEASING.md exists"
grep -q "Node 18, 20, and 22" CONTRIBUTING.md && echo "FAIL: stale node versions remain" || echo "OK: stale CI line fixed"
grep -q "release-please" CONTRIBUTING.md && echo "OK: release flow documented"
```
Expected: `OK: RELEASING.md exists`, `OK: stale CI line fixed`, `OK: release flow documented`

- [ ] **Step 5: Commit**

```bash
git add CONTRIBUTING.md docs/RELEASING.md
git commit -m "docs: document conventional PR titles and the release-please flow"
```

---

## Task 6: Land the strategy PR on `main`

The workflows and config must live on `main` before `release-please` can run or the new checks can be required. This task pushes the branch, opens a PR with a conventional title, gets CI green, and merges.

**Files:** none (operational).

**Interfaces:**
- Consumes: all commits from Tasks 1–5 on `SalZaki/test-release-branch-strategy`.
- Produces: `main` containing the release pipeline. The PR-title check does not run yet (it isn't on `main` until merge); the title is verified by hand here.

- [ ] **Step 1: Preflight — confirm `gh` auth works against github.com**

Run: `GH_HOST=github.com gh api --hostname github.com user --jq .login`
Expected: `SalZaki` (or your login). If this errors, fix auth before continuing.

- [ ] **Step 2: Push the branch**

Run: `git push -u origin SalZaki/test-release-branch-strategy`
Expected: branch pushed; no errors.

- [ ] **Step 3: Open the PR with a conventional title**

Run:
```bash
GH_HOST=github.com gh pr create --base main --head SalZaki/test-release-branch-strategy \
  --title "ci: add trunk-based test-and-release pipeline (release-please)" \
  --body "Implements docs/superpowers/specs/2026-06-24-release-and-branching-strategy-design.md: release-please release workflow + config, PR-title lint, CHANGELOG bootstrap for v1.0.0, and contributor/maintainer docs. Branch protection and the v1.0.0 tag are applied as follow-up operational steps."
```
Expected: a PR URL is printed.

- [ ] **Step 4: Verify CI passes on the PR**

Run: `GH_HOST=github.com gh pr checks --watch`
Expected: the `build-and-test (22)` and `build-and-test (24)` checks conclude **pass**.

- [ ] **Step 5: Merge the PR (squash)**

Run: `GH_HOST=github.com gh pr merge --squash --delete-branch`
Expected: PR merged into `main`; branch deleted on the remote.

- [ ] **Step 6: Sync local `main`**

Run:
```bash
git checkout main && git pull --ff-only origin main
```
Expected: local `main` fast-forwards to include the merge.

---

## Task 7 ⚠️ OUTWARD-FACING: Bootstrap the `v1.0.0` release

> **Confirm with the maintainer before running.** This creates a public git tag and a public GitHub Release on `SalZaki/doodleworks-mcp`. Tags and releases are visible immediately and awkward to retract.

**Files:** none (operational).

**Interfaces:**
- Consumes: `main` at/after the Task 6 merge, and the `## [1.0.0] - 2026-06-24` changelog entry from Task 4.
- Produces: tag `v1.0.0` + a GitHub Release named `v1.0.0`. This becomes release-please's anchor; the next typed `feat:`/`fix:` will open a Release PR for `1.0.1`/`1.1.0`.

- [ ] **Step 1: Confirm no `v1.0.0` tag exists yet**

Run: `GH_HOST=github.com gh api --hostname github.com repos/SalZaki/doodleworks-mcp/git/refs/tags/v1.0.0 2>&1 | grep -q "Not Found" && echo "OK: no v1.0.0 yet" || echo "STOP: v1.0.0 already exists"`
Expected: `OK: no v1.0.0 yet`

- [ ] **Step 2: Confirm you are on the merge commit of `main`**

Run: `git checkout main && git pull --ff-only origin main && git log --oneline -1`
Expected: HEAD is the squash-merge commit from Task 6.

- [ ] **Step 3: Create the tag + GitHub Release from the changelog**

Run:
```bash
GH_HOST=github.com gh release create v1.0.0 \
  --target main \
  --title "v1.0.0" \
  --notes "First public open-source release. See CHANGELOG.md for the full list of tools, the viewer, BYO-key rendering, and the open-source scaffolding."
```
Expected: a release URL is printed; `git fetch --tags` then shows `v1.0.0`.

- [ ] **Step 4: Verify the tag and release exist**

Run:
```bash
git fetch --tags
git tag | grep -q "^v1.0.0$" && echo "OK: tag v1.0.0"
GH_HOST=github.com gh release view v1.0.0 --json tagName --jq .tagName
```
Expected: `OK: tag v1.0.0` and `v1.0.0`.

---

## Task 8 ⚠️ OUTWARD-FACING: Enable branch protection on `main`

> **Confirm with the maintainer before running.** This changes repository settings and how everyone (including you) can push/merge to `main`.

**Files:** none (operational).

**Interfaces:**
- Consumes: the check contexts now visible on `main` — `build-and-test (22)`, `build-and-test (24)` (from `ci.yml`), and `validate` (the `pr-title-lint` job from Task 3).
- Produces: a protected `main` requiring those checks, linear history, and 1 review, with admin bypass left on so the maintainer can merge the no-CI Release PR.

- [ ] **Step 1: Apply branch protection**

Run:
```bash
GH_HOST=github.com gh api --hostname github.com \
  --method PUT repos/SalZaki/doodleworks-mcp/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["build-and-test (22)", "build-and-test (24)", "validate"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```
Expected: a JSON body describing the protection (HTTP 200).

> **Note for the solo maintainer:** `required_approving_review_count: 1` enforces review on *contributor* PRs; you can't approve your own. `enforce_admins: false` lets you (as admin) merge your own PRs and the no-CI Release PR. If self-merge friction isn't worth it, set the count to `0` and re-run this step.

- [ ] **Step 2: Verify protection is active with the right contexts**

Run:
```bash
GH_HOST=github.com gh api --hostname github.com \
  repos/SalZaki/doodleworks-mcp/branches/main/protection \
  --jq '{checks: .required_status_checks.contexts, linear: .required_linear_history.enabled, force: .allow_force_pushes.enabled}'
```
Expected: `checks` contains the three contexts; `linear` is `true`; `force` is `false`.

---

## Task 9: End-to-end validation

Prove the gate works: a PR is blocked until its checks pass, the conventional-title check runs, and the `release` workflow executes on merge.

**Files:**
- Modify: `docs/RELEASING.md` (a one-line, throwaway-safe edit to drive a real PR).

**Interfaces:**
- Consumes: the live pipeline from Tasks 6–8.
- Produces: confirmation that `build-and-test (22/24)` + `validate` gate a PR and the `release` workflow runs green on merge.

- [ ] **Step 1: Create a validation branch with a conventional change**

Run:
```bash
git checkout main && git pull --ff-only origin main
git checkout -b SalZaki/validate-release-pipeline
printf '\n<!-- pipeline validated %s -->\n' "$(git rev-parse --short HEAD)" >> docs/RELEASING.md
git add docs/RELEASING.md
git commit -m "docs: validate the release pipeline end-to-end"
git push -u origin SalZaki/validate-release-pipeline
```
Expected: branch pushed.

- [ ] **Step 2: Open the PR and confirm all three checks are required and run**

Run:
```bash
GH_HOST=github.com gh pr create --base main --head SalZaki/validate-release-pipeline \
  --title "docs: validate the release pipeline end-to-end" \
  --body "Throwaway change to confirm CI + pr-title-lint gate PRs and release-please runs on merge."
GH_HOST=github.com gh pr checks --watch
```
Expected: `build-and-test (22)`, `build-and-test (24)`, and `validate` all appear and conclude **pass**.

- [ ] **Step 3: Confirm a bad title is rejected (negative test)**

Run:
```bash
GH_HOST=github.com gh pr edit --title "validate the release pipeline"
GH_HOST=github.com gh pr checks --watch || true
```
Expected: the `validate` check **fails** (title has no conventional type). Then restore a good title:
```bash
GH_HOST=github.com gh pr edit --title "docs: validate the release pipeline end-to-end"
```
Expected: re-running checks, `validate` passes again.

- [ ] **Step 4: Merge and confirm the `release` workflow ran**

Run:
```bash
GH_HOST=github.com gh pr merge --squash --delete-branch
GH_HOST=github.com gh run list --workflow=release.yml --limit 1
```
Expected: a `release` workflow run for the merge commit, concluding **success**. (A `docs:` change does not bump the version, so no Release PR is expected yet — that is correct. The first `feat:`/`fix:` to land will open the `1.0.1`/`1.1.0` Release PR.)

- [ ] **Step 5: Sync local `main`**

Run: `git checkout main && git pull --ff-only origin main`
Expected: local `main` includes the validation merge.

---

## Done criteria

- `main` is protected: PRs require `build-and-test (22)`, `build-and-test (24)`, and `validate`; linear history; no force-push/deletion.
- A malformed PR title fails the `validate` check (proven in Task 9, Step 3).
- `v1.0.0` tag + GitHub Release exist and anchor release-please.
- The `release` workflow runs on every push to `main`; the next typed `feat:`/`fix:` opens a Release PR that, when merged, cuts `vX.Y.Z` + a GitHub Release and updates `CHANGELOG.md`.
- `CONTRIBUTING.md` and `docs/RELEASING.md` document the flow; no stale Node-version claims remain.
