# Composition patterns — 9 layout archetypes for arranging a contraption

Nine secondary layout shapes that help you ARRANGE the contraption Tinku operates — never a chart, flowchart, or infographic.

## Read this first: layout is secondary, the contraption is primary

The contraption metaphor from `concept-engine.md` does the real work. You take ONE cognitive anchor
from the source — a judgment, a process, a structure, a state, or a metaphor — and build a low-tech,
slightly grotesque rig that Tinku is physically operating. These nine archetypes are only a way to
arrange that rig in the frame. They decide where the parts sit, not what the parts are.

Pick an archetype only after you have the contraption. The shape is a hanger you drape the machine on:
a process laid left-to-right, a cycle bent into a loop Tinku cranks, a stack piled into a tower Tinku
props up. The archetype never becomes the subject.

Hard rules for every archetype below:

- **Never a literal chart.** No axes, no pie slices, no boxes-and-arrows org diagram, no PPT timeline
  bar. The moment an archetype reads as a data graphic, it has failed. It must read as a clean-line
  machine/contraption.
- **The erase-test still governs.** If you could erase Tinku and the picture still made sense, the
  layout went decorative. Redraw so the idea only works because Tinku is doing something to the rig.
  See `concept-engine.md`.
- **Arrows and connectors are drawn LINES.** Pipes, belts, rails, rods, string, chutes — clean drawn
  lines, with small drawn arrowheads where direction matters. Never a typed arrow glyph.
- **One anchor per illustration.** An archetype arranges ONE idea. If two shapes are fighting for the
  frame, that is two illustrations.
- **The house idiom is automatic.** Pure white background, thin clean black line, 50–70% fill with
  generous whitespace, a few small handwritten red/orange/blue annotations. The engine adds all of it
  (`STYLE_LOCK` in `engine.ts`); the page prompt never restates it. See `visual-dna.md`.

For how to turn the chosen layout into the actual `prompt` string, see `prompt-patterns.md`.

## The nine archetypes

Each entry says when the shape helps and gives one concrete contraption sketch in the house idiom.

### process

Use when the anchor is a SEQUENCE — raw input goes through ordered steps and comes out changed. The
steps run in one direction and the order matters.

Sketch: a left-to-right rig on a single bench. Tinku, at the left, feeds lumpy raw material into a
hopper; it travels along a belt or down a chute through two or three crude stations (a stamper,
a sieve, a press) and drops out the right end as neat finished blocks. Tinku is mid-feed, eyes wide
at the pile still waiting. Belt and chute are drawn lines, arrowheads pointing right. One small blue
note at the output: `done`.

### cycle

Use when the anchor LOOPS — output feeds back to input, or the thing only works while someone keeps
it turning. Compounding, feedback, a flywheel, a habit loop.

Sketch: a closed loop of track or belt bent into a ring, with Tinku gripping a hand-crank on its
side. Each pass round the loop the payload grows or changes — a snowball getting bigger on every
circuit, a bucket filling a notch higher. Tinku strains against the crank, mouth set. The loop is one
continuous drawn line; one small drawn arrowhead on the track shows the direction of travel. Orange
annotation `each turn` near the crank.

### stack

Use when the anchor is LAYERS or ACCUMULATION — things piled so each rests on the one below, and the
pile is precarious or load-bearing. Technical debt, a dependency tower, a foundation holding weight.

Sketch: a teetering tower of mismatched patched-together boxes, leaning. Tinku is underneath or beside
it, straining to prop the whole thing up with one bent stick, legs braced, eyes bulging. The higher
boxes teeter; the whole stack leans. A small red annotation on the shakiest box: `held by one stick`.
Erase Tinku and the tower would just stand — so he must be the only thing keeping it up.

### taxonomy

Use when the anchor is a BRANCHING structure — one parent splitting into kinds, a family of related
things. A category tree, a "types of X".

Sketch: a hand-built sorting rig. One chute at the top drops mixed items; Tinku works a set of
hand-flapped paddles or hinged flaps that kick each item into one of three labelled bins below.
Branches are drawn rails fanning downward from the single inlet. Tinku is yanking a paddle to divert
a falling item, watching it go. Keep it to one split into a few bins — not a sprawling org chart.
Small blue bin labels, two or three words each.

### matrix

Use when the anchor is a TWO-AXIS judgment — things placed by where they fall on two qualities at
once. A trade-off, a quadrant of options.

Sketch: a crude pegboard or four-pocket frame that Tinku is hanging items on by hand. Two scales meet
at a corner — one running across, one running up — drawn as plain ruled-by-hand rails, NOT graph
axes. Tinku reaches up to hook one item into the top corner, the others already pegged in their
pockets. The judgment is in WHERE he hangs each thing. One small orange note by the item he is placing:
`best`. Do not let it become a 2x2 chart — it is a physical board he is loading.

### timeline

Use when the anchor is CHANGE OVER TIME — the same thing at a few moments, or a sequence pinned to
when it happened. A before/after, a progression of states.

Sketch: a long taut washing-line strung left to right, with the same object clipped at three points
in worsening or improving condition. Tinku walks the line pegging the next one up, or cranks a reel
that pulls the line along past a fixed marker. The line is one drawn rail; the moments sit on it left
(earlier) to right (later). Small red dates or stage words under two of the pegs, terse. Not a Gantt
bar, not a date axis — a line of pegged objects Tinku tends.

### decision

Use when the anchor is a FORK — a condition that sends you down one of two paths. An if/else, a gate,
a choice with consequences.

Sketch: a track that splits in two with a hand-thrown lever switch at the junction. Tinku grips the
lever, throwing it one way so the cart rolls down the left branch while the right branch sits empty.
His weight is on the lever, eyes on the cart. The two branches are drawn rails diverging from the
switch, an arrowhead on the chosen one. A small blue label on each branch — the two outcomes, a word
or two each. The drama is the lever, not a diamond box.

### data-shape

Use when the anchor is a DISTRIBUTION or PROPORTION — most of something is one way, a long tail is
another; a few parts dominate the whole. The shape of the numbers, not the numbers.

Sketch: a row of buckets of wildly different sizes on a rack, or a hand-balance with one huge weight
against many tiny ones. Tinku is hauling water into the one giant bucket while a string of thimble-
sized buckets sits almost empty beside it, or he hangs off the light end of the balance trying to
lift the heavy side. The PROPORTION is physical — big versus tiny — never a bar chart or pie. One
orange annotation on the dominant part: `most of it`.

### summary

Use when the anchor is a PAYOFF or recap — the one thing to walk away with, the whole idea compressed
into a single object. A closing illustration, the takeaway made concrete.

Sketch: one central contraption that holds the whole point, with everything else stripped away — the
most whitespace of any archetype. Tinku stands at the finished machine doing the single defining
action: pulling the one lever that makes it run, holding up the one block it produced. No row of
steps, no branches — just the machine and the gesture that says "this is the thing." A single small
annotation naming the takeaway in two or three words. If it needs more than one note, it is not a
summary yet.

## Choosing among them

- Sequence that transforms input → **process**. Same loop run again and again → **cycle**.
- Things piled and precarious → **stack**. One thing splitting into kinds → **taxonomy**.
- Judged on two qualities at once → **matrix**. The same thing across moments → **timeline**.
- A condition that forks the path → **decision**. The shape/proportion of a set → **data-shape**.
- The single thing to remember → **summary**.

When two seem to fit, prefer the one whose physical action is most obvious for Tinku to perform — the
clearer his hand-operation, the stronger the page. When none fits cleanly, the metaphor itself from
`concept-engine.md` is enough; an archetype is an aid, not a requirement.

## Before you commit a layout

- The contraption came first; the archetype only arranges it.
- The picture reads as a clean-line machine, NOT a chart, flowchart, or infographic.
- Tinku is physically operating the rig and passes the erase-test.
- Connectors are drawn lines with drawn arrowheads — no typed glyphs.
- One anchor only; generous whitespace; a few terse red/orange/blue annotations.

See `prompt-patterns.md` to write the prompt, and `output-quality.md` for the pre-send bar.
