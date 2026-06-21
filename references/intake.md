# Intake — scoping a set of illustrations

Decide what a set of Tinku illustrations is about, who it serves, and which cognitive anchors to pull — before any contraption is designed or any prompt is written.

## How to use this doc

Intake runs first. Settle the five fields below — from what the user gave you, or from sensible defaults — then hand them downstream:

- `concept-engine.md` turns each chosen **anchor** into a contraption Tinku operates.
- `composition-patterns.md` picks a secondary archetype to *arrange* that contraption.
- `prompt-patterns.md` writes the per-illustration prompt: the contraption, Tinku's action, and the Required-text block.

Intake decides *what the set covers, who reads it, and which ideas become pictures*. It does not design the pictures. Keep it short — a few lines per field, not a form.

A "set" is just a group of single-idea Tinku illustrations on one topic. There is no cover, no title slide, and no sequence that depends on order. Each illustration stands alone.

## What intake never records

Do NOT write down the drawing style, the Tinku character, the accent colours, the pure-white background, the whitespace rule, or the aspect ratio. The image engine adds all of that automatically to every illustration (it lives in `STYLE_LOCK` and `TINKU_CHARACTER` in `engine.ts`). Intake captures only the *content* decisions below. Restating style here wastes effort and risks conflicting with the engine.

So intake has no "look" section. If you find yourself noting "clean line", "black linework", "16:9", "red/orange/blue", or "Tinku is a small worker" — stop. The engine owns those.

## The five fields

### 1. Topic / source — what is this set about?

The subject in one plain sentence, pulled from a topic line, an article, or a source passage. Narrow beats broad: "why context-switching destroys a developer's afternoon" is a set; "productivity" is not.

If you were handed a source (an article or post), read it for its *claims and mechanisms*, not its surface. The set illustrates the source's load-bearing ideas, not a summary of its paragraphs. If the topic is broad, name the single thread you can carry in 4–8 illustrations.

Record the topic as a one-line working title. It seeds nothing visual — it just keeps the set focused.

### 2. Audience — who reads it, and what do they already know?

Two parts: *who they are* and *their starting knowledge*. The same mechanism drawn for newcomers and for practitioners shares almost no anchors.

Knowledge level sets how literal the contraption must be and how much each annotation explains:

- **Newcomer** — anchor on the most basic judgment or metaphor; let the contraption do the teaching; keep annotations plain.
- **Practitioner** — assume the basics; anchor on mechanism, edge cases, and trade-offs; the contraption can be more specific.
- **Decision-maker** — anchor on the stakes and the outcome; pick anchors that show consequence, not internals.

Audience drives which anchors are worth pulling and how many illustrations go to setup versus payoff. **Default:** a curious non-expert who knows the domain exists but not its internals.

### 3. Spine — what shape is the argument?

Pick ONE spine. It decides *which kinds of anchors* dominate the set and roughly how they line up.

- **teaching** — concept → mechanism → worked example → recap. Anchors lean on PROCESS and STRUCTURE. For "explain how X works".
- **persuasion** — problem → stakes → solution → proof → ask. Anchors lean on JUDGMENT and STATE (the bad state now, the better state after). For "convince them to do X".
- **report** — context → findings → implications → next steps. Anchors lean on STATE and STRUCTURE (what is, what it means). For "here is what we found".
- **product** — pain today → the thing → how it works → what you get. Anchors lean on STATE (the pain) then PROCESS (the mechanism). For "here is what we built".
- **knowledge-card** — a few crisp, self-contained ideas, each its own illustration, no journey. Anchors are independent; any of the five kinds. For a reference snapshot.

**Default:** infer the spine from the topic's verb. "How / why / what is" → teaching. "Should / stop doing / you need" → persuasion. "We measured / results / Q3" → report. "Introducing / meet / our new" → product. "Cheat sheet / at a glance / the N things" → knowledge-card. When genuinely ambiguous, default to **teaching**.

The spine is a planning aid, not a slot order the engine enforces. Each illustration still works alone.

### 4. Count — how many illustrations?

**Default:** propose 4–8 illustrations. Honour an explicit count when the user gives one ("just three", "make it ten"); otherwise size to the content — enough that each carries one anchor, few enough that none is filler.

One anchor per illustration is the hard constraint. If an anchor needs two pictures, it is two anchors. If two pictures share an anchor, merge them. Count is really "how many load-bearing anchors does this source have" — answer that, and the count falls out.

An optional 21:9 illustration is a single WIDER hero picture for one especially central anchor — not a cover, not a title card, not a sequence opener. Most sets need none; add one only when one anchor deserves more room. Do not record the 21:9 choice as a "cover".

### 5. Cognitive anchors — which ideas become illustrations?

This is the heart of intake. From the source, pull ONE cognitive anchor per illustration. An anchor is a single idea worth one picture, and it is one of five kinds:

- **JUDGMENT** — a claim, a verdict, a trade-off, a "this beats that".
- **PROCESS** — a sequence of steps, a transformation, a pipeline.
- **STRUCTURE** — how parts relate: a hierarchy, a stack, a layout, a dependency.
- **STATE** — a condition: overloaded, balanced, leaking, blocked, growing.
- **METAPHOR** — a figurative frame the source leans on (a bottleneck, a snowball, a debt).

Rules for pulling anchors:

- **One per illustration.** Never bundle two anchors into one picture.
- **Most load-bearing first.** Pull the anchors the source's argument rests on. Skip decorative or second-order points.
- **Distinct anchors.** Two illustrations should not restate the same judgment in different clothes. If they do, you have one anchor, not two.
- **Pull the idea, not the topic.** The anchor is a cognitive move (a process, a state), not the subject itself. "Caching" is a topic; "a cache turns a slow repeated lookup into a fast one" is a PROCESS anchor.

For each anchor, note its kind and a one-line statement of the idea. That single line is what `concept-engine.md` reinvents as a contraption Tinku operates — and it must survive the erase-test (the idea only works because Tinku is physically doing something to the contraption). Do NOT name the contraption here; choosing the machine is the concept engine's job, not intake's.

Naming the kind matters because it steers the contraption. A PROCESS becomes a rig laid out in steps; a STATE becomes a machine caught in a condition; a JUDGMENT becomes a comparison Tinku is weighing or operating. See `composition-patterns.md` for how the kind maps to a layout.

## How the fields feed the next docs

| Field | Feeds |
| --- | --- |
| Topic / source | Keeps the set focused; bounds which anchors are in scope |
| Audience + knowledge level | How literal each contraption is; which anchors are worth pulling; setup vs payoff |
| Spine | Which anchor kinds dominate and roughly how illustrations line up |
| Count | How many anchors to pull (default 4–8) |
| Cognitive anchors (kind + one-line idea) | `concept-engine.md`: anchor → contraption Tinku operates. `prompt-patterns.md`: the per-illustration prompt and its Required-text block |

Notice what is absent: no style, no palette, no background, no Tinku description, no aspect. The engine adds those. Intake stops at content.

## Minimum viable intake (topic only)

When all you get is a topic, do not block on questions. Apply the default chain:

1. **Spine** — infer from the topic's verb; fall back to **teaching**.
2. **Count** — propose 4–8 illustrations.
3. **Audience** — a curious non-expert (field 2 default).
4. **Anchors** — read the topic (and any source) for its 4–8 most load-bearing cognitive anchors; tag each with its kind and a one-line idea.

Draft the set on these defaults, then let the user correct. A concrete draft of "here are the 6 ideas I'd draw" earns better feedback than a questionnaire. Ask a single question only when one answer would change every illustration — almost always the audience, or which anchors matter most.

## Pre-handoff checks

Before moving to `concept-engine.md`, confirm:

- [ ] The topic is one sentence, narrow enough to carry in the chosen count.
- [ ] The audience and their starting knowledge are named (even if defaulted).
- [ ] Exactly one spine is chosen.
- [ ] The count is set (default 4–8), and it equals the number of anchors pulled.
- [ ] Each anchor is one of the five kinds, stated as a one-line idea, distinct from the others.
- [ ] Each anchor can plausibly survive the erase-test once it becomes a contraption (the idea needs Tinku doing something to it).
- [ ] No style, palette, background, Tinku description, or aspect was recorded — the engine owns all of that.
