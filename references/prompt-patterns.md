# Prompt Patterns

How to write a single illustration's `prompt` string for `create_illustrations` so the engine renders one contraption Tinku operates, with only the words you allow.

## What the prompt is — and is not

The engine wraps every `prompt` you write. `buildPrompt` in `engine.ts` prepends the aspect role line and appends, in order, the Tinku character, the conceptual engine, the house style, and the English-only text policy. So your `prompt` carries only three things:

1. The contraption and the one idea it embodies.
2. What Tinku is physically DOING to that contraption.
3. The closing Required-text block.

Nothing else. The style, the character's looks, the framing, and the text rules are already there. Restating them wastes the prompt and can fight the locked instructions. See `visual-dna.md` (the style), `concept-engine.md` (anchor to contraption), `composition-patterns.md` (arranging it).

## Part 1 — name the contraption and the one idea

Open by naming the device and the single cognitive anchor it stands for. Take ONE anchor from the source — a judgment, a process, a structure, a state, or a metaphor — and turn it into a low-tech, slightly grotesque but physically plausible machine, rig, or workshop scene. Not a literal picture of the topic. Not a chart or flowchart. One anchor per illustration.

State it in one sentence, e.g. "A funnel-crank that shows how one slow step throttles the whole pipeline." Pick at most one secondary archetype from `composition-patterns.md` only to ARRANGE the rig (a process laid left-to-right, a cycle as a loop Tinku cranks) — never to draw a literal diagram.

## Part 2 — describe the contraption and Tinku's action

Describe the rig concretely: its parts, where they sit, what is jamming or flowing or teetering. Then say exactly what Tinku is DOING to it — cranking, straining, plugging, feeding, propping, re-wiring. The action is the load-bearing part of the prompt.

**Erase-test.** If you could remove Tinku and the picture still made complete sense, it is too decorative. Redraw so the idea only works because Tinku is physically operating the device. Tinku is never a mascot or corner decoration. One Tinku per scene, drawn small so the contraption and the whitespace dominate.

**Arrows and connectors are DRAWN LINES.** Never type an arrow glyph (→, ➜, ⟶, =>). When the rig needs a connection, say "a thin clean line from the crank to the hopper" — ink, not a character.

## Part 3 — the Required-text block

End with the only words allowed on the image. Use this exact frame:

```
Required text only (render exactly, and NO other text anywhere in the image): <terse English annotation words>. Do not add any other words, captions, labels, watermarks, or UI text.
```

Rules for the block:

- List the EXACT on-image words, English only, each in quotes. These render as a few small HANDWRITTEN annotations in restrained red, orange, and blue.
- Keep them terse — single words or two-word labels, not sentences. A few per image, used sparingly.
- Note the intended colour in the prose if it matters (e.g. `"JAM" in red`), but the colour name is not on-image text.
- Every word in the picture must be in this block, and every word in the block must appear in the picture. They must match.
- The closing "Do not add any other words…" sentence is mandatory — it tells the engine nothing else is permitted.

## What NOT to restate (the engine owns these)

- The house style — pure white background, clean even black line, whitespace, the red/orange/blue annotation palette. Do not write "clean vector", "pure white", "thin black lines", or any style words.
- Tinku's appearance — the compact solid-black worker, the big expressive eyes, the mitten-hands. Name "Tinku" and give an action; never re-describe his look.
- The aspect and framing — "16:9", "21:9", "landscape", "hero". The engine adds the role line. (You may set `aspect: "21:9"` on the page for one wider hero illustration, but do not describe it in the prompt.)
- The text policy and the erase-test rationale. State the contraption, the action, and the Required-text block — nothing meta.
- Do not type arrow characters or any non-English characters, and never reproduce text from a style-reference image.

---

## Worked examples

Each is the full `prompt` string a host would put on a page. The engine adds everything else.

### A — Bottleneck (judgment: one slow step throttles the whole flow)

```
A funnel-crank contraption. A wide hopper at the top is heaped with small boxes; they all pour down into a single funnel whose neck is far too narrow, so the boxes pile up and jam above the opening, only one squeezing through at a time into a tray below. Tinku stands at the side gripping a hand-crank that drives the funnel, eyes wide and straining, mouth set with effort as he forces it round against the jam. Draw a thin clean line from the crank to the funnel neck to show the linkage. Required text only (render exactly, and NO other text anywhere in the image): "JAM" in red beside the piled-up boxes; "1 at a time" in blue by the tray. Do not add any other words, captions, labels, watermarks, or UI text.
```

Erase-test: remove Tinku and there is no one forcing the jammed crank — the idea collapses. Passes.

### B — Technical debt (state: a patched-together structure barely holding up)

```
A teetering tower of mismatched boxes and crates, lashed together with tape and string, leaning hard to one side. Tinku is wedged underneath it, both mitten-hands braced on a single thin stick that he jams up against the tower to stop it toppling, legs splayed, eyes bulging with strain, mouth clenched. A few boxes near the top are already sliding. Draw thin clean lines for the tape and string holding the stack together. Required text only (render exactly, and NO other text anywhere in the image): "PATCHED" in orange on a mid-stack box; "do not touch" in red near the top. Do not add any other words, captions, labels, watermarks, or UI text.
```

Erase-test: without Tinku propping it, the tower just falls — the picture only works because he is holding it. Passes.

### C — Context-switching (process: re-plugging mid-task loses the work in hand)

```
A wall of sockets with a tangle of cables. Tinku is yanking one cable out of a socket marked "A" and stretching to jam it into a far socket marked "B", his body twisted between them. As he does it, two other plugs spring loose and a small box he was holding tumbles from under his arm, mid-fall. His eyes are wide and his mouth open in alarm. Draw the cables as thin clean lines crossing between the sockets. Required text only (render exactly, and NO other text anywhere in the image): "A" in blue by the left socket; "B" in blue by the right socket; "dropped" in red by the falling box. Do not add any other words, captions, labels, watermarks, or UI text.
```

Erase-test: the dropped box and the half-swapped cable only make sense because Tinku is doing the swap. Passes.

---

## Quick checklist before you send an illustration

- Names one contraption and the one anchor it embodies — judgment, process, structure, state, or metaphor.
- Describes the rig concretely and says exactly what Tinku is DOING to it.
- Passes the erase-test: remove Tinku and the idea collapses.
- One Tinku, drawn small; the contraption and whitespace dominate.
- Arrows and connectors described as drawn lines, never typed glyphs.
- Required-text block present, English only, terse words quoted, matching the picture.
- Closing "Do not add any other words…" sentence present.
- No restated style, no restated Tinku looks, no restated aspect or framing.

See the siblings for the rest: `concept-engine.md` (anchor to contraption and the erase-test), `composition-patterns.md` (arranging the rig), `visual-dna.md` (the locked style), and `output-quality.md` (the pre-send bar).
