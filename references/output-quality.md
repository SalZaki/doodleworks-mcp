# Output Quality

The quality bar for a set of Tinku illustrations and the checklist the planner runs before emitting `create_illustrations`.

This doc is the gate. Style, anchors, composition, and prompt shape are upstream; this is the last pass before a payload ships. The host LLM never controls the drawing style or the character — the engine's `STYLE_LOCK`, `TINKU_CHARACTER`, and `CONCEPT_ENGINE` add those. Your job is to write page prompts the engine can render cleanly, and to catch the few mistakes that quietly degrade a set.

## The quality bar

A set passes when every illustration below is true, and the illustrations read as one coherent set.

### One idea per illustration
Each illustration carries ONE cognitive anchor — a single judgment, process, structure, state, or metaphor — rendered as ONE contraption Tinku operates. If a page tries to show a mechanism AND a worked example AND three caveats, it is three pages. Split it. Fast test: say the idea out loud in one sentence. If you need "and" to join two thoughts that aren't the same thought, it's two illustrations.

### The erase-test passes
Tinku must be OPERATING the contraption, not standing beside it. Cover Tinku with your thumb: if the picture still makes complete sense without him, he was decorative and the composition has failed. Redraw so the idea only works because Tinku is physically doing something to the rig — cranking it, feeding it, propping it up, plugging the leak. See `concept-engine.md` for the erase-test and worked transformations.

### Pure-white background
The background is pure white. No paper texture, no beige or cream tone, no grid, no border or frame, no drop shadow, no gradient. White is the quietest thing on the page; everything else sits on it with room to breathe.

### Clean, even, black linework
Clean vector-style line illustration: confident, smooth black outlines of even, consistent weight, like clean ink or a vector stroke — deliberate and tidy, never sketchy, never wobbly, no pencil, no hatching. Tinku himself is filled with confident solid matte black; the contraption and the rest of the page are open line drawings. Line weight stays even and consistent across the set — no switching between "bold thick outlines" and "delicate fine lines" page to page.

### Subject at 50–70% with generous whitespace
The contraption and Tinku together fill only about 50–70% of the frame. The rest is whitespace. A prompt that crams in clusters of labelled parts fights the framing and produces a busy page. Draw it smaller; let the white dominate. Keep the contraption scale comparable across the set so no single illustration reads as zoomed-in or zoomed-out next to its neighbours.

### Sparse handwritten English annotations
On-image text is a few small HANDWRITTEN annotations in restrained red, orange, and blue, used sparingly. Text names parts; the drawing carries the meaning. ALL text is English. The page prompt's `Required text only:` block is the ONLY text permitted — render exactly those words and nothing else: no captions, labels, watermarks, UI chrome, or page numbers. Never reproduce text or non-English characters from a style-reference image. See `prompt-patterns.md` for the block format.

### Arrows are drawn lines
Every arrow and connector is a drawn line with a small drawn arrowhead — part of the illustration. Never a typed glyph (`→`, `➜`, `=>`). Typed arrows render as text, break the clean line look, and slip past the English-only intent. When a prompt needs connection, write "a thin drawn line from A to B," never "A → B".

### Restrained red / orange / blue only
Accent colour is red, orange, and blue only, used sparingly on the annotations and the odd marker — never saturated, never a large-area fill, never a fifth colour. Most of the page is black line on white. Colour marks the one thing that matters, not every part.

### 16:9, and not a literal picture or a chart
Every illustration is 16:9 landscape. An optional 21:9 is a single wider hero illustration, not a titled cover — there is no cover and no sequencing. The image is NEVER a literal depiction of the topic and NEVER a chart, flowchart, infographic, or PPT-style diagram. If you can read the page as a literal photo of the subject or as a labelled diagram, the conceptual engine was skipped. See `concept-engine.md`.

### Tinku never derived from references
Tinku's look comes ONLY from the `TINKU_CHARACTER` constant in `engine.ts`. He is never derived from a third-party character and never from the style-reference images — those calibrate DRAWING STYLE only (clean, even line weight, pure-white background, whitespace, restraint), never character or composition. At most one Tinku per scene, drawn small so the contraption and the whitespace dominate.

### Visual consistency across the set
The set must look like one body of work, not a folder of unrelated sketches. Same line weight, same pure-white background, same restrained red/orange/blue, same clean even line weight on every illustration, same Tinku. Because pages render independently, consistency comes from (a) the engine's style lock and (b) prompts that don't drift — don't ask one page for thick outlines and the next for fine lines, don't introduce a new colour, don't switch the background tone, keep contraption scale comparable.

## Pre-send checklist

Run this before emitting `create_illustrations`. Every box must be checked.

- [ ] Each illustration expresses exactly ONE cognitive anchor (judgment, process, structure, state, or metaphor).
- [ ] Each illustration is built as ONE contraption Tinku is actively OPERATING.
- [ ] The erase-test passes on every page: remove Tinku and the idea breaks (he is not decorative).
- [ ] No page is a literal picture of the topic.
- [ ] No page is a chart, flowchart, infographic, or PPT-style diagram.
- [ ] Each page prompt names the contraption, then Tinku's physical action on it, then the Required-text block.
- [ ] No page prompt restates the drawing style, the character, the aspect, or the English-only policy (the engine adds those).
- [ ] Every page ends with a `Required text only (render exactly, and NO other text anywhere in the image): …` block.
- [ ] Each Required-text block is terse, handwritten-style, and English only — no sentences-as-captions.
- [ ] The Required-text block is followed by "Do not add any other words, captions, labels, watermarks, or UI text."
- [ ] No typed arrow glyphs (`→`, `➜`, `=>`) anywhere — every connector is described as a drawn line.
- [ ] No non-English characters and no text copied from any style-reference image.
- [ ] Annotation colour is red, orange, or blue only — nothing saturated, nothing large-area filled, no other colours.
- [ ] No prompt derives Tinku (or any character) from a reference image or third-party character.
- [ ] Composition leaves generous whitespace; the subject sits at roughly 50–70% of the frame.
- [ ] Line weight, background, colour, and contraption scale are consistent across all illustrations.
- [ ] Every illustration is 16:9 (or a single deliberate 21:9 wider hero — not a titled cover).
- [ ] The set delivers the spine and anchors captured in intake (see `intake.md`).

## Common failure modes

Each entry is a way a set goes wrong and the fix.

- **Literal topic picture.** The page draws the subject as it actually looks instead of an anchor-as-contraption. Fix: pull ONE cognitive anchor and reinvent it as a low-tech rig Tinku runs (see `concept-engine.md`); never picture the topic directly.
- **Decorative Tinku that fails the erase-test.** Tinku stands beside the scene, points at it, or sits in a corner — remove him and nothing changes. Fix: make the idea depend on his action; he cranks, feeds, props, or plugs the contraption so erasing him breaks the picture.
- **Chart / flowchart / infographic.** Boxes, nodes, and arrows arranged as a literal diagram, or a process drawn as numbered steps. Fix: use a secondary archetype only to ARRANGE the contraption (a process laid left-to-right, a cycle as a loop Tinku cranks); never let it become a literal chart. See `composition-patterns.md`.
- **Typed arrows.** Writing `A → B` or `=>` makes the model render a text arrow that breaks the clean line look. Fix: describe "a thin drawn line from A to B with a small arrowhead."
- **Non-English or stray text.** Captions, watermarks, page numbers, UI chrome, or characters copied from a reference leak onto the page. Fix: keep text to the `Required text only:` block and append the "Do not add any other words…" line so nothing else is permitted.
- **Saturated or off-palette colour.** A bright fill, colour-coding every part, or a colour outside red/orange/blue kills restraint and emphasis. Fix: a few small red/orange/blue handwritten marks only; the rest stays black line on white.
- **Paper texture or shadows.** A beige/cream tone, sketchbook grain, a frame, or drop shadows creep in. Fix: keep the background pure white and flat — no texture, no shadow, no gradient, no border.
- **Crammed multi-idea frame.** Two contraptions, a list, and an example fight for one frame; the whitespace is gone. Fix: one anchor and one contraption per illustration — split the rest into their own pages or cut them, and re-check the count against the spine.
