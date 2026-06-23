# Security Policy

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue for an
unpatched vulnerability.

- Preferred: open a private report via GitHub
  → **Security → Report a vulnerability** (GitHub Private Vulnerability Reporting)
  on this repository.
- Or email: **salzaki@hotmail.com** with `[doodleworks-mcp security]` in the subject.

Please include reproduction steps, the affected version/commit, and the impact
you observed. You can expect an acknowledgement within a few days. Because this
is a personal-tier project maintained in spare time, fixes are best-effort —
thank you for your patience.

## Scope

This is a **local, single-user MCP server**. The most relevant areas:

- **Bring-your-own API key.** The image-provider key (OpenAI/Gemini) is read from
  the server's environment and is used **server-side only** — it must never appear
  in a tool result, `_meta`, `structuredContent`, a log line, an error message, or
  the viewer iframe. A path that leaks the key into any of those is in scope.
- **Style-reference path handling.** A model/host-supplied `styleReference` is
  sandboxed to `assets/style-references/`. A traversal that escapes that directory
  to read arbitrary files is in scope.
- **The sandboxed viewer.** XSS or sandbox-escape in the rendered viewer
  (it displays model-generated titles/prompts) is in scope.
- **Cost safety.** Inputs that let a single call enqueue an unbounded number of
  paid image renders against the user's key.

Out of scope: vulnerabilities in third-party image providers, and issues that
require an attacker who already controls the host machine or the MCP host process.

## Supported versions

The latest commit on `main` is supported. There is no long-term-support branch.
