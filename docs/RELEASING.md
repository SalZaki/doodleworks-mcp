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
