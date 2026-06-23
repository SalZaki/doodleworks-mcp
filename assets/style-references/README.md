# Style-reference library

Each image file in this folder is **one style reference**, identified by its filename (its *id*) and
discovered at runtime. Drop in a `.png` / `.jpg` / `.webp` / `.gif` and it's available immediately —
no rebuild and no list to edit.

A reference steers only the **drawing style** (clean, even line weight, pure-white background,
whitespace, restraint). The engine still draws your contraption and Tinku, in English, and is told
**not** to copy the reference's subject, character, layout, or text.

## Using a reference

Set one three ways (all optional — with none set, sets render exactly as before):

- per illustration — `illustrations[i].styleReference`
- set-wide — `create_illustrations`'s top-level `styleReference` (per-illustration wins)
- a server default — `export DOODLEWORKS_STYLE_REF=your-reference.png`

Each accepts a **library id** (a filename in this folder), a **data-URI**, or a **local path**.
Model/host-supplied paths are sandboxed to this folder; only the operator-set `DOODLEWORKS_STYLE_REF`
env var may point elsewhere.

> **Caveat:** style conditioning steers the linework *toward* the reference, so an unwanted subject,
> character, or caption can bleed in. Pick references whose linework you want and whose
> character/text you don't.

## Gallery & context

The bundled references come in three example sets. Each filename is `<set>-NN-<slug>.png`, where the
slug is the illustration's one-line idea — so the id itself tells you the context. The sets walk
through a single topic, illustration by illustration.

Illustrations that drifted off the Tinku house style have been quarantined into the **`_off-model/`**
subfolder — they're still here for reference but aren't ideal style refs, and are marked **⚠ off-model**
below. `examples/net-ai-stack.json` is a title-free `create_illustrations` payload for regenerating the
`net-*` set on-model.

### `net-*` — the .NET AI stack (a 10-part explainer)

| Id | The idea it illustrates |
| --- | --- |
| `net-00-the-net-ai-stack` | Cover — the whole stack at a glance — ⚠ off-model (`_off-model/`) |
| `net-01-2023-the-painful-beginning` | Early days: hand-rolled `HttpClient` calls, ~200 lines, brittle |
| `net-02-the-semantic-kernel-years` | The Semantic Kernel era and its complexity — ⚠ off-model (`_off-model/`) |
| `net-03-the-foundations-crack` | Why the older foundations started to break down — ⚠ off-model (`_off-model/`) |
| `net-04-two-layers` | The two layers: `Microsoft.Extensions.AI` (foundation) + `Microsoft.Agents.AI` — ⚠ off-model (`_off-model/`) |
| `net-05-one-foundation-many-interfaces` | One foundation exposing many interfaces (`IChatClient`, `IImageGenerator`, …) |
| `net-06-swap-providers-keep-your-code` | Swap providers without rewriting your code — ⚠ off-model (`_off-model/`) |
| `net-07-agents-with-tools` | Agents that call tools |
| `net-08-clean-typed-results` | Messy text in → clean, strongly-typed results out — ⚠ off-model (`_off-model/`) |
| `net-09-start-here-grow-anytime` | Start small today, grow into the agent framework later — ⚠ off-model (`_off-model/`) |

### `nrt-*` — nicotine replacement therapy (a 6-part explainer)

| Id | The idea it illustrates |
| --- | --- |
| `nrt-00-nicotine-not-the-poison` | Nicotine isn't the harmful part — tar and toxins are |
| `nrt-01-the-forms-of-nrt` | The forms NRT comes in |
| `nrt-02-holds-cravings-down` | How NRT holds cravings steady |
| `nrt-03-combination-therapy` | Combining a patch with a fast-acting form — ⚠ off-model (`_off-model/`) |
| `nrt-04-wind-it-down` | Tapering the dose down over ~12 weeks |
| `nrt-05-doubles-your-chances` | NRT roughly doubles your chance of quitting — ⚠ off-model (`_off-model/`) |

### `wiki-*` — a self-tending knowledge wiki (a 6-part explainer)

| Id | The idea it illustrates |
| --- | --- |
| `wiki-00-less-code-more-knowledge` | Less code, more knowledge |
| `wiki-01-ingest-into-a-linked-wiki` | Ingest sources into a linked wiki |
| `wiki-02-the-llm-tends-it` | The LLM tends and curates it |
| `wiki-03-q-a-no-fancy-rag` | Ask anything — Q&A without fancy RAG |
| `wiki-04-outputs-add-up` | Outputs accumulate over time |
| `wiki-05-health-checks` | Periodic health checks |

> **Note on the captions you see in these PNGs.** Some references (the `net-*` set) have a title
> caption rendered into the image; the `nrt-*` and `wiki-*` sets do not. These captions were added
> when the examples were authored — the engine itself does **not** draw a title onto a render
> (`buildPrompt` never injects `title`, and the house style forbids extra captions). The title you
> pass to `create_illustrations` is shown as a caption **in the viewer** and can optionally be burned
> into a **downloaded** PNG (in a clean band below the artwork). If you regenerate these references,
> expect clean linework with only the inline `Required text only:` annotations — no baked title.

## Provenance & licensing

The references committed here (`net-*`, `nrt-*`, `wiki-*`) are the **project's own** work, provided
so the house style works out of the box. Note that they are **images**: the repository's MIT license
covers the *code*, not the artwork. (Maintainer: pick an explicit asset license — e.g. CC0-1.0 or
CC-BY-4.0 — if you want to grant reuse of these PNGs beyond running the app.)

If you add references you did **not** create, make sure you have the right to use and redistribute
them before committing them to a fork.
