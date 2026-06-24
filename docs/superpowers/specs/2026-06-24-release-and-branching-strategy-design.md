# Release & branching strategy — design

- **Date:** 2026-06-24
- **Status:** Approved (design); pending spec review
- **Scope:** Branching model, automated test gate, and release mechanism for `doodleworks-mcp`.

## 1. Problem

Development on `doodleworks-mcp` merges into `main` through PRs, but there is **no release
mechanism**: no git tags, no GitHub Releases, no publish step, and a hand-maintained
`CHANGELOG.md` with an `[Unreleased]` section that nothing consumes. "When development is
done, it should be properly tested and released" has no implementation today.

The request was framed as "create test and release branches". This design deliberately does
**not** add long-lived `test`/`develop`/`release` branches — for a solo-maintained,
personal-tier OSS project that is Git Flow ceremony with no payoff. The test-and-release gate
is provided by CI plus a reviewable, automated **Release PR**, not by extra branches.

## 2. Goals / non-goals

**Goals**

- Every change reaching `main` is build- and test-verified before it can ship.
- Cutting a release is one reviewable action that bumps the version, updates `CHANGELOG.md`,
  tags the commit, and creates a GitHub Release — driven by the conventional-commit history
  the project already writes.
- The maintainer chooses *when* to release (no auto-ship on every merge).
- A clear, documented path to `npx doodleworks-mcp` distribution without reworking the model.

**Non-goals**

- No `develop`/`test`/`release` long-lived branches.
- No Docker/container release (YAGNI for a bring-your-own-key local MCP server).
- No npm publish in phase 1 (the package stays `"private": true` until phase 2).
- No change to the test framework, the Tinku sync gate, or the viewer build.

## 3. Decision summary

| Dimension | Decision |
|---|---|
| Branching | **Trunk-based.** `main` is always releasable and protected. Short-lived `SalZaki/*` feature branches → PR → squash-merge. |
| Test gate | Existing `ci.yml` (build + test, Node 22/24) becomes a **required status check** on `main`. |
| Release gate | A `release-please` **Release PR** accumulates merged changes; merging it cuts the release. CI runs on it; the maintainer reviews the changelog and approves. |
| Versioning | SemVer, derived from conventional commits by `release-please`. |
| Changelog | `release-please` takes ownership of `CHANGELOG.md` going forward; the historical `[1.0.0]` entry is preserved. |
| Commit/PR titles | Conventional Commits enforced on PR titles (because squash-merge uses the PR title as the commit subject). |
| Distribution | **Phase 1:** tagged GitHub Releases (works while private). **Phase 2:** flip `private: false`, add an npm publish step → `npx doodleworks-mcp`. |
| Optional RC flow | A short-lived `release/x.y.z` branch + `vX.Y.Z-rc.N` pre-release tag is *documented* for stabilization windows but is not part of the day-to-day flow. |

## 4. Branching model

```
SalZaki/<short-description>   ── short-lived feature/fix branch
        │  open PR (conventional title)
        ▼
       CI  ── build + test on Node 22 & 24 (required)
        │  squash-merge
        ▼
      main  ── protected, always releasable
        │  release-please opens/updates a Release PR as commits land
        ▼
  Release PR  ── version bump + CHANGELOG; CI runs; maintainer approves
        │  merge
        ▼
   tag vX.Y.Z + GitHub Release   (+ npm publish in phase 2)
```

- **`main`**: the only long-lived branch. Protected: linear history, required CI check,
  required PR review, no direct pushes.
- **Feature branches**: keep the existing `SalZaki/<short-description>` convention (matches
  `docs/ISSUE_WORKFLOW.md`). One PR per User Story.
- **Release PR**: created and maintained by `release-please`, not by a human. It is the
  test-and-release checkpoint — green CI plus a human-reviewed changelog.

### Why not `test`/`develop`/`release` branches

- The automated test gate already runs on every PR; a `test` branch would re-run the same
  checks with extra merge bookkeeping.
- A `develop` branch only earns its keep when many contributors need an integration buffer
  separate from a slower release cadence — not the case here.
- A long-lived `release` branch is for parallel stabilization of an old line while `main`
  moves on. A solo project that ships from the tip of `main` doesn't have that problem. The
  RC flow in §8 covers the rare stabilization need without a permanent branch.

## 5. Test gate

No change to *what* runs — `ci.yml` already builds (type-check + viewer bundle + Tinku sync)
and tests on Node 22 and 24. The change is to make it **enforced**:

- Mark the `build-and-test` job a **required status check** in branch protection for `main`.
- Require at least one approving review and linear history.

This guarantees nothing merges to `main` (and therefore nothing can be released) without a
green build + test on both supported Node versions.

## 6. Release mechanism — `release-please`

`release-please` (Google's release automation) is chosen over the alternatives because it fits
what the project already does and keeps the maintainer in control of timing:

- It reads **Conventional Commits** (already in use: `feat:`, `fix:`, `chore:`, `docs:`, `ci:`).
- It maintains **`CHANGELOG.md`** and the **SemVer** version automatically.
- It opens a **Release PR** that is reviewable and only releases **on merge** — unlike
  `semantic-release`, which ships on every push to `main` and removes timing control.

### Files added

- **`.github/workflows/release.yml`** — runs `googleapis/release-please-action` on push to
  `main`. Permissions: `contents: write`, `pull-requests: write`. Release type: `node`.
- **`release-please-config.json`** — single root package, `release-type: node`,
  `changelog-sections` mapping conventional types to readable headings.
- **`.release-please-manifest.json`** — pins the current version so the next bump is computed
  from commits after the baseline (see §7 bootstrap).

### Flow

1. Feature PRs merge to `main` with conventional titles.
2. `release-please` opens/updates a Release PR titled `chore(main): release X.Y.Z`, with the
   computed version bump and generated changelog entry.
3. CI runs against the Release PR (see §9 for the GITHUB_TOKEN caveat).
4. Maintainer reviews the changelog, confirms CI is green, and merges.
5. On merge, `release-please` creates the **git tag `vX.Y.Z`** and the **GitHub Release** with
   notes drawn from the changelog.

### Changelog transition

The current `CHANGELOG.md` uses Keep-a-Changelog headings (`Added`/`Changed`) with an
`[Unreleased]` block. `release-please` generates its own sections (e.g. **Features**,
**Bug Fixes**). Decision: **`release-please` owns `CHANGELOG.md` from adoption onward**; the
existing `[1.0.0]` entry is preserved beneath the auto-managed region, and the `[Unreleased]`
items are folded into the bootstrap release (§7). `changelog-sections` in the config maps
conventional types to friendly headings to keep the output readable.

## 7. Bootstrap (cutting the real v1.0.0)

There is no `v1.0.0` tag today, so the first act is to make the current, CI-green `main` an
official, tagged release — which is precisely "development done → properly tested → released":

1. Fold the current `[Unreleased]` changelog items into a dated `1.0.0` (or `1.1.0` if the
   accumulated work since the original 1.0.0 warrants a minor bump — decided at implementation
   time from the commit history) entry.
2. Set `.release-please-manifest.json` to that baseline version.
3. Tag the baseline commit and publish the corresponding GitHub Release (manually for the
   bootstrap, or via the first `release-please` run).
4. Thereafter, `release-please` computes every subsequent version from commits after the
   baseline tag.

## 8. Conventional-commit / PR-title enforcement

Because merges are **squash-merges**, the PR title becomes the commit subject that
`release-please` parses. A malformed title silently mis-computes the version. Mitigation:

- Add **`.github/workflows/pr-title-lint.yml`** using `amannn/action-semantic-pull-request` to
  validate every PR title against the Conventional Commits grammar.
- Document the allowed types and the squash-title rule in `CONTRIBUTING.md`.

## 9. Known caveat — CI on the Release PR

PRs and commits created with the **default `GITHUB_TOKEN` do not trigger other workflow runs**
(a deliberate GitHub anti-recursion rule). So the `release-please` Release PR may not run
`ci.yml` automatically. Options, in order of preference:

- **Accept it (recommended for phase 1):** every constituent change already passed CI before
  merging to `main`; the Release PR only edits `CHANGELOG.md` and the version. The gate is
  intact.
- **Run CI on it explicitly:** add the `release-please` PR's label/branch to `ci.yml` triggers
  so it re-verifies the bumped state.
- **Use a PAT / GitHub App token** for `release-please` so its PR triggers workflows normally
  (more setup; reconsider in phase 2 when a publish actually rides on the release).

The chosen default is documented in the workflow file so the behavior is not surprising.

## 10. Phase 2 — npm / `npx` distribution (documented, not built now)

When ready to publish:

1. Set `"private": false`; add `"bin"`, `"files"` (include built `dist/`), and confirm
   `prepare`/`prepublishOnly` builds the viewer bundle so the published tarball is runnable.
2. Add an npm publish step to the `release-please` workflow, gated on the `release_created`
   output, using **OIDC + `npm publish --provenance`** (`id-token: write`), npm ≥ 9.5.
3. Verify `npx doodleworks-mcp` boots the server for a clean consumer.

Phase 2 is intentionally out of scope for the first implementation; this section exists so the
phase-1 design doesn't paint us into a corner.

## 11. Files changed / added

| Path | Change |
|---|---|
| `.github/workflows/release.yml` | **new** — `release-please` automation |
| `release-please-config.json` | **new** — release-please config (root, `node`, changelog sections) |
| `.release-please-manifest.json` | **new** — version baseline |
| `.github/workflows/pr-title-lint.yml` | **new** — conventional PR-title check |
| `.github/workflows/ci.yml` | unchanged behavior; becomes a required check via branch protection |
| `CHANGELOG.md` | reconciled for bootstrap; `release-please`-owned thereafter |
| `CONTRIBUTING.md` | document conventional PR titles, the Release PR flow, and how to cut a release |
| `docs/` (optional) | a short `RELEASING.md` describing the maintainer's release procedure |
| Branch protection on `main` | configured in repo settings (manual or via a committed ruleset) |

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Non-conventional PR title mis-bumps the version | PR-title lint (§8) blocks the merge |
| Release PR doesn't run CI (GITHUB_TOKEN) | Documented; constituent PRs already passed CI (§9) |
| Changelog format churn at adoption | `release-please` owns it going forward; 1.0.0 history preserved (§6) |
| Phase-2 publish ships an unbuilt tarball | `files`/`prepare` checklist + `npx` smoke test before flipping `private` (§10) |
| Branch protection not reproducible in code | Capture settings in a committed ruleset or document them in `RELEASING.md` |

## 13. Open questions

None blocking. The minor/major decision for the bootstrap version (§7) is resolved at
implementation time by reading the commit history since the original 1.0.0.
