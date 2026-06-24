# Contributing to Doodleworks MCP

Thanks for your interest! This is a personal-tier project, but issues and pull
requests are welcome.

## Development setup

You need **Node.js 22+** and **pnpm 9+** (the lockfile is `lockfileVersion: 9.0`;
`corepack enable` will pick up the version pinned in `package.json`'s
`packageManager` field).

```bash
pnpm install            # install dependencies
pnpm build              # type-checks + bundles the viewer into dist/mcp-app.html
pnpm test               # type-checks the tests, then runs them (~1s, no API calls)
```

**No API key is needed to build or test.** The test suite injects a fake
`renderPage`, so it never calls the paid image API. You only need a real
`OPENAI_API_KEY` / `GEMINI_API_KEY` to render actual illustrations at runtime
(see [`.env.example`](.env.example) and the README).

For live iteration:

```bash
pnpm start              # watch-build the viewer + restart the HTTP server on edits
```

## Tests come first

This project follows a failing-test-first workflow. Before changing behaviour in
`server.ts`/`engine.ts`, add or adjust a test under `test/` using the harness in
`test/mcp-harness.ts` (`startTestClient(renderPage)`, `fakeImage()`,
`waitForIllustration()`), watch it fail, then make it pass. A `render failed: …`
line in the output is an intentional stderr log from the error-path test, not a
failure.

## The Tinku sync gate

`Tinku` is defined **once** in `engine.ts` as `TINKU_CHARACTER` and quoted
verbatim in `references/visual-dna.md`. `pnpm build` runs `pnpm run check:tinku`,
which fails if the two drift. If you edit the character, edit `engine.ts` (the
source of truth) and paste it verbatim into the `> Tinku is …` blockquote in
`references/visual-dna.md`.

## Pull requests

1. Branch from `main`.
2. Keep changes focused; update the README/docs when behaviour changes. Do not
   edit `CHANGELOG.md` by hand — release-please generates it from the commit
   history (see "Conventional commits & releases" below).
3. **`pnpm build` and `pnpm test` must pass** before you open the PR — CI runs
   both on Node 22 and 24, and both are required status checks on `main`.
4. Match the surrounding code style (the codebase favours explicit types, errors
   to stderr only, and comments that explain *why*).

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

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).
