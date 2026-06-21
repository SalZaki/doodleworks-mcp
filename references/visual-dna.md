# Visual DNA — the Tinku house style

The single source of truth for how every illustration looks: pure white, clean even black line, whitespace, sparse red/orange/blue annotations, and the Tinku character — all of which the engine bakes into every page automatically.

## What this is for

Each illustration in a set is generated on its own, yet the whole set must read as one hand. This style lock makes that happen. The engine adds everything below to every image (it lives in the `STYLE_LOCK` and `TINKU_CHARACTER` constants in `engine.ts`), so a host LLM writing page prompts never restates it. The prompt describes only the page's idea: the contraption, Tinku's action, and the Required-text block. See `prompt-patterns.md` for what a page prompt actually contains, and `concept-engine.md` for turning a source into a contraption.

## Background — pure white

- The background is **pure white**. Flat. Nothing behind the drawing.
- It must **NOT** have paper texture, grain, or a sketchbook tone.
- It must **NOT** be beige, cream, ivory, or any off-white.
- **No shadows, no gradients**, no vignette, no soft glow.
- No border, no frame, no grid, no dot grid, no ruled lines, no torn edge.

The white is the loudest part of the page, not a backdrop you decorate. The line sits directly on it with room to breathe.

## Linework — clean, even, black

- **Clean vector-style black linework** carries the whole drawing — confident, smooth contour lines of even, consistent weight, like clean ink or a vector stroke.
- The line is deliberate and tidy. No sketchy strokes, no pencil, no hatching, no scribble, no rough shading.
- Line weight stays even and consistent across the page, with clean curves and tidy geometry.
- Tinku himself is the one exception to "open line": he is filled with **confident solid matte black** (see below). The contraption and the scene around him stay as open black line.
- No smooth digital gradients, no airbrushing, no soft fills on the contraption.

## Whitespace and the 50–70% rule

- **Generous whitespace.** Empty white is a feature, not wasted space.
- The subject — the contraption plus Tinku operating it — fills only **about 50–70% of the frame**. It does not bleed to the edges or fill the page corner to corner.
- The whitespace should dominate around the subject so the single idea lands instantly.
- One idea per illustration. Keep the composition uncluttered.

When in doubt, draw it smaller. A calm, mostly-empty frame reads as confident; a crammed one reads as a corporate slide.

## Annotations — sparse red/orange/blue, English only

- A few small **HANDWRITTEN ENGLISH** annotations in restrained **red, orange, and blue**, used **sparingly**.
- These are the only colour on the page. Everything else is black line on white.
- Annotations mark or name one thing — a label on the part that matters, a short word by the jamming point. They are not a colour scheme spread across the drawing.
- Keep them small as neat handwritten-style labels. No typeset captions, no neon, no big colour fills.
- Two or three light touches is plenty; an illustration can use none at all. Full rules in **On-image text** below.

## Mood

Light, weird, and individual — **clean, modern, and polished but characterful**, creative without being childish or saccharine. It reads as the work of one odd, capable maker with a point of view, not a corporate design team.

The character is in the absurd, over-built contraption and Tinku's strained effort — never in gore or grime. Clean line, lots of white, one strange idea.

## The refuses-list — what this is NOT

- **Not** polished flat or commercial illustration.
- **Not** a PPT-style infographic, chart, or flowchart.
- **Not** cute, kawaii, or chibi.
- **Not** a mascot or emoji-sticker.
- **Not** a literal depiction of the topic — always a contraption Tinku operates (see `concept-engine.md`).
- **Not** a decorative Tinku that fails the erase-test (see below).

## Tinku

Tinku is the app's **OWN original recurring character** — not a person who happens to appear, but the worker who physically operates the contraption that embodies the idea. His look comes **only** from the `TINKU_CHARACTER` constant in `engine.ts`, quoted here:

> Tinku is a small, boldly simple ink-drawn worker — NOT a standard little person with a separate head, neck, and torso. His whole body is ONE continuous solid matte-black shape: a single rounded egg/teardrop blob, slightly taller than wide, chunky and grounded, with NO neck and NO separate head — the head and the body are the same mass. He is filled with confident solid matte black and drawn with the same clean, smooth, even black line as the rest of the page (deliberate and tidy, not sketchy or wobbly). His face sits high on that mass and is EXPRESSIVE and reactive (not deadpan): two large round white eyes that widen, squint, or strain with the effort of the task, and a simple mouth showing concentration, surprise, or resolve. On the crown he has a signature tuft of EXACTLY three short upward ink sprigs — small and always present, never a full head of hair. He has EXACTLY two arms and EXACTLY two legs and nothing more. The arms are short, simple, and slightly tapering, set high on the blob, each ending in one small rounded mitten-hand built for gripping; relaxed arm length is about half the body height — never long or thin. The legs are two short stubby legs, slightly splayed for a planted stance. He is forever pulling levers, turning cranks, feeding hoppers, propping things up, plugging leaks. Limb discipline: never a third arm or leg, never duplicated, forked, or branching limbs, never an extra hand. Because he is a solid black shape, keep his arms and legs simple and well-separated so they never merge into each other, into a tangle, or into the contraption he is operating. Genderless, culture-neutral, no logos or text on him. Defining rule: Tinku is NEVER a mascot, sticker, or corner decoration — he is the absurd worker physically OPERATING the contraption that embodies the article's idea. Test: if you could erase Tinku and the picture still made complete sense on its own, he was merely decorative and the composition has failed — redraw it so the idea only works because he is doing something to it. At most one Tinku per scene, drawn small so the contraption and the whitespace dominate the frame.

Key constraints:

- **Tinku is the app's OWN character.** His appearance comes **only** from the definition above. He is **never** derived from a third-party character.
- **Never from references.** The style-reference images calibrate **drawing style only** — clean, even line weight, the pure-white background, the amount of whitespace, the restraint. They never define Tinku's likeness, face, body, or pose. Do not copy a character from any reference.
- **Solid black fill.** Tinku is the one filled shape on the page; the contraption around him stays open black line.
- **Expressive, never deadpan.** His eyes and mouth show the strain of the task.
- **Operating, never decorating.** He is gripping, cranking, propping, plugging — physically running the contraption.
- **The erase-test.** If you could erase Tinku and the picture still made complete sense on its own, he is decorative and the composition has failed. Redraw so the idea only works because he is doing something to the contraption. See `concept-engine.md`.
- **At most one Tinku per scene, drawn small**, so the contraption and the whitespace dominate the frame.

See `prompt-patterns.md` for how a page prompt names Tinku and his action, and `concept-engine.md` for turning the idea into the contraption he runs.

## On-image text

- **ALL on-image text is ENGLISH ONLY**, rendered as a few small **HANDWRITTEN** annotations in restrained **red, orange, and blue**, used sparingly.
- The page prompt's **"Required text only:"** block is the **only** permitted text. Render exactly those words and **no** others — no extra captions, labels, watermarks, UI text, page numbers, or page furniture.
- Draw arrows and connectors as **clean drawn lines**. Never type arrow characters (→, ➜, ⇒). An arrow is ink, not a glyph.
- **Never reproduce text or non-English characters from any style-reference image.** References calibrate drawing style, not words.

This keeps the set legible and on-brand and stops stray text from references or model habit leaking onto the page. See `output-quality.md` for the pre-send check that catches unwanted text.

## The engine applies all of this automatically

Everything above — the pure-white background, the clean, even black linework, the whitespace and the 50–70% rule, the sparse red/orange/blue English annotations, the mood, the refuses-list, the Tinku character, the conceptual engine, the 16:9 aspect role, and the English-only text policy — is added by the image engine to every illustration. It lives in the `STYLE_LOCK`, `TINKU_CHARACTER`, `CONCEPT_ENGINE`, and `TEXT_POLICY` constants in `engine.ts`.

**So page prompts must NOT restate it.** A page prompt states only the single idea: the contraption, Tinku's concrete action on it, and the Required-text block. Restating the style, the character, or the framing wastes prompt budget and risks conflicting instructions. See `prompt-patterns.md`.
