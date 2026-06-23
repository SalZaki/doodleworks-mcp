# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Open-source scaffolding: `LICENSE` (MIT), `.gitignore`, `.env.example`,
  `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, GitHub issue/PR
  templates, and a CI workflow (build + test on Node 18/20/22).
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

## [1.0.0]

- Initial release: `create_illustrations`, `regenerate_illustration`, and
  `get_illustration` tools; the `plan_illustrations` prompt; bundled
  `doc://doodleworks/*` planning resources; the in-host viewer with
  prev/next, regenerate, and download; OpenAI / Gemini bring-your-own-key
  rendering; and the extensible style-reference library.
