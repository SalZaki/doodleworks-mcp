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

## Branching

Branch off `main` and name the branch `<type>/<short-description>`, where `<type>`
is one of the [Conventional Commit types](#commit-messages) and the description is
kebab-case:

```
feat/hero-aspect          fix/2k-aspect-size      docs/readme-render-speed
refactor/extract-parser   chore/bump-deps         test/eviction-coverage
```

A husky `pre-commit` hook rejects a branch that doesn't match the pattern (`main`
is the only exempt branch) and tells you how to fix it. Rename a mis-named branch
with `git branch -m <type>/<short-description>`, or skip the check once with
`git commit --no-verify`.

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org):
`type(optional-scope): subject` — e.g. `feat: add 21:9 hero aspect` or
`fix(server): bail background renders for an evicted set`. Allowed types are
`build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`,
`style`, and `test`.

A husky `commit-msg` hook runs `commitlint` (`@commitlint/config-conventional`)
and rejects any message that doesn't conform — the hook is installed for you by
`pnpm install` (via the `prepare` script). Write the message conventionally:

```bash
git commit -m "fix: correct the 2k aspect size"
```

## Releases

Releases are automated by [release-please](https://github.com/googleapis/release-please).
As Conventional commits land on `main`, it maintains a **Release PR** that bumps the
version (`feat` → minor, `fix`/`perf` → patch, `!` or `BREAKING CHANGE` → major) and
regenerates `CHANGELOG.md`. Merging that PR tags `vX.Y.Z` and publishes a GitHub
Release, so **don't hand-edit `CHANGELOG.md`** — it is generated.

Because PRs are **squash-merged**, the PR *title* becomes the commit subject on `main`,
and that subject — not the individual commits — is what release-please reads. So a PR
title must itself be a valid Conventional Commit; a `pr-title-lint` check enforces it.
(The local `commit-msg` hook validates your commits; the squash title is set on GitHub,
so CI validates it there.) Maintainers: see [`docs/RELEASING.md`](docs/RELEASING.md).

## Pull requests

1. Branch from `main` using the [branch-naming convention](#branching).
2. Keep changes focused; update the README/docs when behaviour changes
   (release-please owns `CHANGELOG.md` — see [Releases](#releases)).
3. **`pnpm build` and `pnpm test` must pass** before you open the PR — CI runs
   both on Node 22 and 24, and both are required status checks on `main`.
4. Match the surrounding code style (the codebase favours explicit types, errors
   to stderr only, and comments that explain *why*).
5. The PR **title** must be a Conventional Commit too — it becomes the squash-merge
   subject and is checked by `pr-title-lint` (see [Releases](#releases)).

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).
