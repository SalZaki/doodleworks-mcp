# Doodleworks MCP — personal MCP App

[![CI](https://github.com/SalZaki/doodleworks-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/SalZaki/doodleworks-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Node >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![status: personal-tier](https://img.shields.io/badge/status-personal--tier-orange)

> Status — personal-tier / experimental. A local, single-user MCP server you run yourself. It builds
> and its test suite passes (see [Status & validation](#status--validation)), but it's maintained in
> spare time; bring your own image-API key and expect rough edges.

Renders single-idea, clean-line "Tinku" illustrations for an article or post and shows them in an
interactive viewer inside your MCP host: flip through, regenerate any image, download PNGs. This is the
personal tier — a local stdio server, bring-your-own image API key (read from the environment), images
passed inline as data-URIs.

The house style is clean vector-style line illustration: a single picture on a pure-white background,
confident smooth black lines of even weight, lots of whitespace, and a few neat handwritten-style
red/orange/blue English annotations. The engine never draws the topic literally. It runs a conceptual
engine that turns one cognitive anchor into a low-tech contraption that Tinku, the app's own character,
is physically operating.

The planning knowledge ships with the app, so no separate skill is needed:

- a `plan_illustrations` prompt turns a topic into a `create_illustrations`-ready set of illustrations, and
- the planning docs are bundled as `doc://doodleworks/*` resources any host can read.

All on-image text is English-only, and you can optionally condition generation on a style-reference image
for drawing-style consistency. A "set" is a group of single-idea Tinku illustrations (each 16:9, with an
optional 21:9 hero). With nothing extra configured, it still renders through the same tools and viewer.

## Quick start

```bash
git clone https://github.com/SalZaki/doodleworks-mcp.git
cd doodleworks-mcp
pnpm install
pnpm build                    # type-checks + bundles the viewer into dist/mcp-app.html
export OPENAI_API_KEY=sk-...   # or GEMINI_API_KEY / GOOGLE_API_KEY — bring your own
```

Then point a graphical MCP host at `main.ts --stdio` (see [Add it to a host](#add-it-to-a-host)) and
ask it to create illustrations. No API key is needed to build or test — only to render.

## How it works

An MCP App is a tool plus a UI resource. `create_illustrations` renders the illustrations and carries
`_meta.ui.resourceUri`, so the host fetches the `ui://doodleworks-mcp/viewer.html` resource, renders it
in a sandboxed iframe, and hands the tool result to the View.

Two design choices keep your context clean and stay under the MCP per-result size cap: no image bytes go
in `content`, and `create_illustrations`'s result carries only a `setId` plus illustration metadata, not
the rendered PNGs. The server keeps the freshly-rendered images in a small in-process LRU (the last 8
sets), and the View pulls each illustration via a separate `get_illustration` call — one image per tool
result, well under the cap at any resolution and illustration count.

Regeneration: `regenerate_illustration` takes the same prompt back and renders a fresh take. Called from
the viewer it carries the `setId + index`, so the cache is updated in place; close and reopen the viewer
and the regenerated illustration is what you see.

```
host LLM ── create_illustrations(illustrations[]) ──▶ server: renderPage() × N  (OpenAI / Gemini, your key)
                                          │   cache.set(setId, illustrations)
   model sees: 1-line summary ◀── content + structuredContent (no bytes)
   viewer sees: { setId, illustration metadata } ◀── _meta["doodleworks/set"]
                                          │
   viewer renders shell, then per illustration ──▶ get_illustration({ setId, index })
                                          │   cache.get(setId).illustrations[index]
   one image per tool result          ◀── _meta["doodleworks/illustration"].dataUri ──▶ iframe gallery
                                          │
   regenerate / download  ◀── viewer calls regenerate_illustration(setId, index) ──▶ cache.update
```

## Prerequisites

- Node.js 18+
- An image API key in the server's environment:
  - `OPENAI_API_KEY` → OpenAI GPT Image 2 (default), or
  - `GEMINI_API_KEY` / `GOOGLE_API_KEY` → Gemini 3 Pro Image (Nano Banana Pro)
- (optional) `DOODLEWORKS_STYLE_REF` → a default style-reference id/path (see [Style-reference library](#style-reference-library)).
- (optional) `DOODLEWORKS_QUALITY` → default image quality `low | medium | high | auto` (default `low`; raise it when you want more texture — see [Render speed](#render-speed)).
- (optional) `DOODLEWORKS_CONCURRENCY` → illustrations rendered in parallel (default `3`, safe for tier-1 OpenAI quotas; raise to `6+` if your tier allows).
- An MCP host that renders MCP Apps UI (see [Hosts](#hosts) below).

## Setup

```bash
pnpm install
pnpm build             # type-checks and bundles the View into dist/mcp-app.html
export OPENAI_API_KEY=sk-...
```

> Dependencies are pinned and `pnpm-lock.yaml` is committed, so `pnpm install` is reproducible. The
> MCP and image SDKs move fast; if you bump them, re-run `pnpm build && pnpm test` to confirm nothing
> shifted under you (see the SDK-shape note in [Status & validation](#status--validation)).

## Development

```bash
pnpm start             # watch + serve: rebuilds dist on viewer edits, restarts the server on server edits
```

`pnpm start` runs two watchers together:

- `vite build --watch` re-bundles `src/mcp-app.ts` + `mcp-app.html` into `dist/mcp-app.html` on every viewer edit, and
- `tsx watch main.ts` restarts the Streamable HTTP server (on `:3001`) on every server/engine edit.

The server reads `dist/mcp-app.html` fresh whenever the file's mtime changes (not just once at
startup), so a viewer rebuild reaches the host without restarting the server process. Point the
ext-apps basic-host or the MCPJam inspector at `http://localhost:3001/mcp` and your viewer edits show
up on the next tool call.

> Caveat for stdio hosts (Claude Desktop): the host caches the rendered UI resource within a
> session, so after a rebuild start a fresh chat (or re-invoke `create_illustrations`) to pick it
> up. If you change `server.ts`/`engine.ts` while the host launched the server itself (not via
> `pnpm start`), restart the host so it relaunches the process.

## Testing

```bash
pnpm test              # type-checks the tests, then runs them (~1s, no API calls)
```

`create_illustrations` hits the paid image API, so the suite never does. Tests inject a fake
`renderPage` via `createServer({ renderPage })` and drive the real tools over the SDK's in-memory
transport, so the full orchestration (caching, streaming, regenerate, errors) is exercised offline
for free. Use this to gain confidence before any live run. The stack is `node:test` + `tsx` (no extra
dependencies); files live in `test/` (`tsconfig.test.json` type-checks them).

Covered (`test/`):

| Test file | What it locks in |
| --- | --- |
| `create-illustrations.test.ts` | Returns a `setId` and no image bytes in `content`/`structuredContent` |
| `get-illustration.test.ts` | Streams pending → ready; surfaces the real provider error; `missing` for an unknown set |
| `regenerate-illustration.test.ts` | Replaces the cached image in place; replays the set's `resolution`/`styleReference` when the viewer omits them |
| `cache-lru.test.ts` | Evicts the oldest set past the 8-set LRU bound |

The harness (`test/mcp-harness.ts`) exposes `startTestClient(renderPage)`, `fakeImage()`, and
`waitForIllustration()` — write new behaviour as a failing test here before touching `server.ts`.
A `render failed: …` line in the output is the server's intentional stderr log from the
error-path test, not a test failure.

## Add it to a host

This runs over stdio. Point your host at `main.ts` with `--stdio` (via `tsx`, no separate compile
step needed for the server). Example MCP-server config:

```json
{
  "mcpServers": {
    "doodleworks-mcp": {
      "command": "npx",
      "args": ["-y", "tsx", "/ABSOLUTE/PATH/doodleworks-mcp/main.ts", "--stdio"],
      "env": { "OPENAI_API_KEY": "sk-..." }
    }
  }
}
```

Replace `/ABSOLUTE/PATH/doodleworks-mcp/main.ts` with the absolute path to your clone (run `pwd` in the
repo; on Windows use a path like `C:\path\to\doodleworks-mcp\main.ts`). Run `pnpm build` first so
`dist/mcp-app.html` exists (the UI resource reads it) — a missing bundle makes the viewer hang on
"Waiting for the illustrations…". To test the viewer without a full host, use the ext-apps basic-host
or the MCPJam inspector: run `pnpm start` here (Streamable HTTP on `:3001`) and point the host at
`http://localhost:3001/mcp`.

## The tools

- `create_illustrations` — `{ title?, illustrations: [{ title, archetype?, aspect?, prompt, styleReference? }], resolution?, quality?, styleReference? }`.
  Each `prompt` is one illustration's contraption + Tinku's action + a `Required text only:` block. The
  server adds the Tinku character, the conceptual engine, and the house style automatically, so don't restate
  them. The `illustrations` array takes 1–8 entries (the per-set cap; one paid render each).
  `aspect` defaults to `16:9`; `21:9` is an optional wider hero (not a cover). `resolution` is `1k`
  (default) or `2k`. `quality` is `low | medium | high | auto` (default `low`; raise it when texture matters
  — see [Render speed](#render-speed)). `styleReference` (set-wide, or per illustration) is optional — see
  [Style-reference library](#style-reference-library) below. Returns `{ setId, illustrations: [{ index, title,
  archetype, aspect, prompt }] }` in `_meta` — no image bytes, and never the `styleReference`. Renders in the
  background and returns immediately; the viewer streams illustrations in via `get_illustration` as each finishes.
- `regenerate_illustration` — `{ prompt, aspect?, archetype?, title?, resolution?, styleReference?, setId?, index? }`.
  Re-renders one illustration (image models are non-deterministic, so you get a fresh take). App-only
  (`visibility: ["app"]`): the viewer's Regenerate button calls it with `setId + index`, which updates the
  cached image in place. Hidden from the model's tool list.
- `get_illustration` — `{ setId, index }` → one illustration's rendered image. App-only
  (`visibility: ["app"]`): the viewer iframe calls this for each illustration after `create_illustrations`, so the
  model doesn't see it in its tool list and the per-result size cap is never under pressure.

An illustration `prompt` describes a contraption Tinku operates — for example (see `examples/tinku-contraptions.json`):

```
A tall, narrow funnel on a little frame, its neck far too thin. Identical small boxes pile up and JAM in a
heap above the neck; only a thin trickle dribbles out the bottom. Tinku stands on a step gripping a hand-crank
on the funnel's side with both hands, straining to force the pile through, eyes squeezed shut.

Required text only (render exactly, and NO other text anywhere in the image): a label on the funnel neck
"the bottleneck"; one word by the jam "stuck"; one word by the trickle "output". Do not add any other words,
captions, labels, watermarks, or UI text.
```

## Plan illustrations (the `plan_illustrations` prompt)

The app ships with the planning knowledge, so you don't need a separate skill to go from a topic to a set of
illustrations. Invoke the MCP prompt (it surfaces in hosts as `/mcp__doodleworks-mcp__plan_illustrations`):

- Args: `topic` (required), `audience?`, `count?` (integer; omit to propose 4–8 illustrations),
  `spine?` (`teaching | persuasion | report | product | knowledge-card`).
- It returns a message embedding the planning rules: extract distinct cognitive anchors from the source,
  reinvent each as a contraption Tinku operates (with the erase-test), one 16:9 illustration per anchor,
  each `prompt` a concrete contraption + Tinku's action plus a `Required text only:` block (terse English,
  red/orange/blue, arrows as lines), and asks the host LLM to finish by emitting one `create_illustrations` call. It
  deliberately does not restate the house style, the character, or the framing, because `engine.ts` adds those.

## Bundled planning knowledge (`doc://` resources)

The full planning docs are registered as MCP resources, so any host has them even without a separate skill:

| Resource | What's in it |
| --- | --- |
| `doc://doodleworks/visual-dna` | The house style: pure-white background, clean even black line, whitespace, red/orange/blue annotations, Tinku |
| `doc://doodleworks/concept-engine` | Cognitive anchor → a contraption Tinku operates; the erase-test; no literal pictures |
| `doc://doodleworks/composition-patterns` | The 9 secondary layout aids for arranging a contraption — never a literal chart |
| `doc://doodleworks/prompt-patterns` | How to write an illustration `prompt`: contraption + Tinku's action + the Required-text block |
| `doc://doodleworks/intake` | Questions to scope a set: topic/source, audience, spine, count, the anchors to pull |
| `doc://doodleworks/output-quality` | The quality bar and a pre-send checklist |
| `doc://doodleworks/style-references` | The style-reference ids currently available (discovered at runtime) |

The markdown lives in `references/` and is read on demand; edit those files to tune the planning advice.

## Tinku — the app's own character

The recurring figure is Tinku, defined once in `engine.ts` as the `TINKU_CHARACTER` constant: a small,
solid-black ink-drawn worker whose whole body is one continuous rounded egg-blob — no separate head or
neck — with two big reactive eyes, a three-sprig hair tuft on the crown, and two short arms ending in gripping
mitten-hands. He is always physically operating the contraption that embodies the idea — cranking, straining,
propping, plugging — at most one per scene, drawn small. He is never a mascot or decoration: if you could erase
Tinku and the picture still made sense, the composition has failed (the erase-test). Tinku is the app's own
original character; edit `TINKU_CHARACTER` to restyle him. His look comes only from that constant, never from a
third-party character and never from the style-reference images, which calibrate drawing style only.

## English-only on-image text

Every image renders English-only text — a few small handwritten red/orange/blue annotations, and only the
words in the illustration's `Required text only:` block. No other captions, labels, watermarks, or UI text,
and never text or non-English characters copied from a style-reference image. Arrows and connectors are drawn
as lines, never typed characters. This is baked into `buildPrompt` in `engine.ts`, so it holds for every render.

## Style-reference library

`assets/style-references/` is an extensible library: each image file is one reference, identified by its
filename (its id), discovered at runtime. Drop in your own `.png/.jpg/.webp/.gif` and it's available
immediately, with no rebuild and no list to edit. Use one to keep the drawing style (clean, even line weight,
the pure-white background, whitespace, restraint) consistent.

Set a reference three ways (all optional — with none set, sets render exactly as before):

- per illustration: `illustrations[i].styleReference`
- set-wide: `create_illustrations`'s top-level `styleReference` (per-illustration wins)
- a server default: `export DOODLEWORKS_STYLE_REF=your-reference.png`

Each accepts a library id, a data-URI, or a local path. When active, OpenAI conditions via `images.edit`
(the reference as the input image) and Gemini attaches it as an `inlineData` part, and the prompt explicitly
tells the model to take only the drawing style from it — still drawing your contraption and Tinku, in English,
and not copying the reference's character, layout, or text. The reference is handled server-side only; it (and
your API key) never reach the View.

> Caveat: style conditioning steers the linework toward the reference, so an unwanted subject,
> character, or caption in a reference can bleed in. Pick references whose linework you want and whose
> character/text you don't.

The library holds the project's own style references. If you add references you didn't create, make
sure you have the right to use and redistribute them.

## Render speed

At the defaults (`quality=low`, 3-wide concurrency, `1k` resolution) a typical 4–8 illustration set finishes in
well under a minute. Lifting `quality` to `medium` or `high` is what costs the most time; `2k` and a tight
OpenAI rate-limit tier slow it down further. `create_illustrations` returns immediately and streams illustrations
into the viewer as they finish, so the call never times out — wall-clock is whatever the image model takes.

Tunables:

- `DOODLEWORKS_QUALITY` (or per-call `quality`) — `low` (default) is fine for line art. Raise to `medium` or
  `high` when you want more texture or shading detail.
- `DOODLEWORKS_CONCURRENCY` (default `3`) — illustrations rendered in parallel. Tier-1 OpenAI image quotas are
  around 5 RPM, so 3 finishes the first wave without 429s; raise to `6+` when your tier allows. The engine
  retries 429s and honors `Retry-After`, but the burst still costs wall-clock.
- Resolution — `1k` (default) is faster than `2k`.
- Fewer images per set is the simplest lever.

## The cache + pull tradeoff (why this is the personal tier)

Images stay as inline data-URIs (zero infrastructure, no key-handling liability), but they're
served one-at-a-time from a small in-process LRU keyed by `setId` instead of being packed into
a single tool result. That dodges the MCP per-result size cap entirely, so `2k` sets and longer
illustration counts work the same as a 3-illustration `1k` set. The cost: the cache only lives as long as the
server process. Restart the server (or roll past the LRU bound of 8 sets) and old `setId`s 404.
For an interactive session that's fine. If you need sets to survive process restarts, share them
across users, or skip the in-memory custody altogether, that's the signal to move to the hosted
tier: persist images in object storage and return https URLs (and there, BYOK becomes
per-connection header auth, with the key-custody responsibilities that implies). The generation
engine and the viewer stay the same; only image delivery changes.

## Bring-your-own-key, safely

The key is read from the server's environment and used server-side only. It is never placed in the tool
result, never sent to the View, and never exposed to the iframe JavaScript. Keep it in your host's `env`
block (above) or your shell, not in any file you commit.

## Hosts

MCP Apps render in graphical hosts — Claude Desktop, ChatGPT, VS Code, Goose, Postman, and the MCPJam
inspector — with support still rolling out, so check your host's current state. It does not render in the
Claude Code terminal (no webview for an iframe); the skill version is the right tool there, while this App
is for graphical hosts.

## Status & validation

`pnpm install && pnpm build && pnpm test` runs green: the build type-checks the server and viewer,
passes the Tinku sync check, and bundles `dist/mcp-app.html`; the offline test suite (no API calls)
passes. CI re-runs build + test on Node 18, 20, and 22 on every push and PR, using pnpm 10.34.3 (the
latest pnpm line that still supports Node 18 — pinned via `packageManager`).

What the tests don't cover, since they never hit the paid image API: the live `openai` / `@google/genai`
image calls themselves. The project targets the official MCP Apps quickstart API (`registerAppTool` /
`registerAppResource` / `RESOURCE_MIME_TYPE`, the `App` bridge with `ontoolresult` / `callServerTool`),
and tool `inputSchema` is given as a Zod shape (matching the quickstart). If you bump the MCP SDK and it
expects raw JSON Schema instead, that's a small adjustment — do a live render once after any SDK upgrade
to confirm the provider calls still line up.

## Files

```
doodleworks-mcp/
├── engine.ts          # image generation (OpenAI/Gemini) + sizes + STYLE_LOCK + TINKU_CHARACTER + CONCEPT_ENGINE + style-ref conditioning
├── server.ts          # create_illustrations + regenerate_illustration tools, plan_illustrations prompt, doc:// resources, viewer UI resource
├── main.ts            # stdio + Streamable HTTP entry
├── mcp-app.html       # View shell (bundled to a single file by Vite)
├── src/mcp-app.ts     # View logic: gallery, prev/next, regenerate, download (App bridge)
├── references/        # bundled planning docs, served as doc://doodleworks/* resources
│   ├── visual-dna.md  ├── concept-engine.md      ├── composition-patterns.md
│   ├── prompt-patterns.md  ├── intake.md         └── output-quality.md
├── examples/
│   └── tinku-contraptions.json   # sample create_illustrations payload (contraption metaphors)
├── assets/
│   └── style-references/   # the extensible style-reference library (add your own images here)
│       ├── README.md       # how to add and use a reference
│       └── <set>-NN-*.png  # the project's own Tinku-style references, grouped by set prefix (nrt-, wiki-, net-)
├── package.json
├── tsconfig.json
├── tsconfig.server.json
└── vite.config.ts
```
