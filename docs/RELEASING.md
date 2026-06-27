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

## One-time repo setup

release-please opens its Release PR using the built-in `GITHUB_TOKEN`, which is
only allowed when **Settings → Actions → General → Workflow permissions → "Allow
GitHub Actions to create and approve pull requests"** is enabled. It is off by
default; without it the `release` job fails with _"GitHub Actions is not permitted
to create or approve pull requests."_ It is already enabled for this repo —
re-enable it if the `release` job ever fails with that message.

## Versioning

Semantic Versioning, derived from commit types since the last `vX.Y.Z` tag:
`feat:` → minor, `fix:`/`perf:` → patch, `feat!:` / `BREAKING CHANGE:` → major.

## Bootstrap (one time)

The baseline `v1.0.0` tag + GitHub Release were created from `main` at the first
public release. release-please computes every later version from commits after
that tag.

## npm / npx publishing

Published to npm automatically on each release via the `publish-npm` job in
`release.yml`, using **OIDC trusted publishing** (no stored token) with a
provenance attestation. Consumers run `npx doodleworks-mcp`.

**Setup (npmjs.com):** a *trusted publisher* is registered on the
`doodleworks-mcp` package — owner `SalZaki`, repo `doodleworks-mcp`, workflow
`release.yml`. This requires the package to already exist (npm does not support
pre-registering a trusted publisher for a not-yet-published name), so the very
first publish was bootstrapped with a temporary token (see Bootstrap below);
every release since authenticates keyless via OIDC.

**How a version reaches npm:** merging a release-please Release PR creates the
GitHub Release (`release_created`), which runs `publish-npm` → build →
packaged-tarball smoke test → `npm publish --provenance`.

**Bootstrap — first npm publish (one time):** 1.0.0 was published via the workflow's
`workflow_dispatch` with input `publish_ref: main` — the `v1.0.0` git tag predates
the publishing machinery, so the publishable 1.0.0 code lives on `main`. Because a
trusted publisher can't be pre-registered for a non-existent package, that first
publish authenticated with a temporary `NPM_TOKEN` (a classic Automation token,
which bypasses 2FA) while still attesting provenance via OIDC. The token was then
removed and the trusted publisher registered, so all later releases publish keyless.
