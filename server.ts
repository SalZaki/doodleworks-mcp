/**
 * server.ts — registers the Doodleworks MCP tools and the viewer UI resource.
 *
 * MCP Apps pattern: a tool carries `_meta.ui.resourceUri`, the host renders the
 * matching `ui://` HTML resource in a sandboxed iframe, and the tool result is
 * delivered to that View.
 *
 * Context-safety: heavy image bytes never appear in `content`; the model only
 * sees the short summary and the compact `structuredContent`. To stay under the
 * MCP per-result size cap, `create_illustrations` returns ONLY illustration metadata + a
 * setId in `_meta`. The View fetches each rendered image via `get_illustration` — one
 * image per call, comfortably under the cap at any resolution and set size.
 */

import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  listStyleReferences,
  listStyleReferencesSync,
  renderPage as defaultRenderPage,
  type PageSpec,
  type Quality,
  type RenderOptions,
  type RenderedImage,
  type Resolution,
} from "./engine.js";
import {
  META_CONTRACT_KEY,
  META_ILLUSTRATION_KEY,
  META_SET_KEY,
  TOOL_CREATE_ILLUSTRATIONS,
  TOOL_GET_ILLUSTRATION,
  TOOL_REGENERATE_ILLUSTRATION,
  VIEWER_CONTRACT_VERSION,
  type Aspect,
  type Illustration,
} from "./types.js";

/** The illustration renderer, injectable for tests; production uses the real engine. */
type RenderPageFn = (page: PageSpec, opts?: RenderOptions) => Promise<RenderedImage>;

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(MODULE_DIR, "dist");
const REFERENCES_DIR = path.join(MODULE_DIR, "references");
const RESOURCE_URI = "ui://doodleworks-mcp/viewer.html";

// Planning knowledge bundled with the app and surfaced as doc:// resources, so any host has the
// planning rules even without the doodleworks-tech-slides skill installed. plan_illustrations embeds
// the core rules inline; these resources hold the full text.
const REFERENCE_DOCS: ReadonlyArray<{ name: string; title: string; description: string }> = [
  { name: "visual-dna", title: "Visual DNA", description: "The Tinku house style: pure-white background, clean even black line, sparse red/orange/blue handwritten English annotations." },
  { name: "concept-engine", title: "Concept engine", description: "Cognitive anchor → low-tech contraption Tinku operates; the erase-test; no literal topic pictures." },
  { name: "composition-patterns", title: "Composition patterns", description: "Secondary layout aids (process, cycle, stack, taxonomy, matrix, timeline, decision, data-shape, summary) for arranging a contraption — never a literal chart." },
  { name: "prompt-patterns", title: "Prompt patterns", description: "How to write an illustration prompt: contraption + Tinku's action + the Required-text block (red/orange/blue, terse)." },
  { name: "intake", title: "Intake", description: "Questions to scope a set: topic/source, audience, spine, count, the cognitive anchors to illustrate." },
  { name: "output-quality", title: "Output quality", description: "The quality bar and a pre-send checklist (erase-test, pure-white, sparse annotations, 16:9, no flowchart)." },
];

const SPINES = ["teaching", "persuasion", "report", "product", "knowledge-card"] as const;
// Background-render concurrency. 3 is the safe default for OpenAI tier-1 image quotas (~5 RPM):
// 6+ reliably triggers 429s on the first wave, and each retry pays a fresh Retry-After delay
// that's slower wall-clock than just queueing here. Bump to 6+ if your tier can absorb the burst.
const DEFAULT_RENDER_CONCURRENCY = 3;
function readRenderConcurrency(): number {
  const raw = process.env.DOODLEWORKS_CONCURRENCY;
  if (raw === undefined || raw === "") return DEFAULT_RENDER_CONCURRENCY;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    console.warn(
      `[doodleworks-mcp] ignoring DOODLEWORKS_CONCURRENCY=${JSON.stringify(raw)} (expected a positive integer); using ${DEFAULT_RENDER_CONCURRENCY}.`,
    );
    return DEFAULT_RENDER_CONCURRENCY;
  }
  return n;
}
const RENDER_CONCURRENCY = readRenderConcurrency();
// Bounded in-memory cache so a long-lived server doesn't grow without limit.
// Each set holds N PNG data-URIs; 8 sets is generous for an interactive session.
const MAX_CACHED_SETS = 8;

type RenderStatus = "pending" | "ready" | "error";

interface CachedIllustration extends Illustration {
  /** Per-illustration render lifecycle so get_illustration reports progress instead of "not found". */
  status: RenderStatus;
  error?: string;
  /** Per-illustration style ref from the PageSpec — replayed on regen if the call doesn't override
   * it, so the viewer's regenerate (which doesn't know the ref) keeps the set's calibration. */
  styleReference?: string;
}

interface CachedSet {
  title: string | null;
  illustrations: CachedIllustration[];
  /** Set-wide style ref from create_illustrations — same replay-on-regen rationale as CachedIllustration. */
  styleReference?: string;
  /** Resolution chosen at create_illustrations. The viewer's regenerate call doesn't pass it, so
   * without this a 2k set would silently regen at the 1k default. */
  resolution?: Resolution;
  /** Quality chosen at create_illustrations. Same reason: the viewer doesn't echo it back on regen. */
  quality?: Quality;
}

// Map preserves insertion order, so we get LRU by re-inserting on touch and
// evicting from the front when over capacity.
const setCache = new Map<string, CachedSet>();

function rememberSet(setId: string, set: CachedSet): void {
  setCache.set(setId, set);
  while (setCache.size > MAX_CACHED_SETS) {
    const oldest = setCache.keys().next().value;
    if (oldest === undefined) break;
    setCache.delete(oldest);
  }
}

function touchSet(setId: string): CachedSet | undefined {
  const entry = setCache.get(setId);
  if (!entry) return undefined;
  setCache.delete(setId);
  setCache.set(setId, entry);
  return entry;
}

/**
 * Render every illustration of a set in the background, writing each image into the cached set as
 * it finishes (and recording per-illustration errors). create_illustrations returns immediately and
 * the viewer streams illustrations via get_illustration, so a slow multi-image render never blocks
 * the tool call past the host's request timeout. Errors are captured per illustration, so this
 * never rejects.
 */
async function renderSetInBackground(
  renderPage: RenderPageFn,
  setId: string,
  specs: PageSpec[],
  resolution: Resolution,
  setStyleRef: string | undefined,
  quality: Quality | undefined,
): Promise<void> {
  const set = setCache.get(setId);
  if (!set) return;
  const illustrations = set.illustrations;
  let cursor = 0;
  // Bounded concurrency keeps wall-time down without tripping image-API rate limits.
  const workers = Array.from(
    { length: Math.min(RENDER_CONCURRENCY, specs.length) },
    async () => {
      while (true) {
        const i = cursor++;
        if (i >= specs.length) return;
        try {
          // Per-illustration styleReference (on the spec) wins over the set-wide one inside renderPage.
          const img = await renderPage(specs[i], { resolution, styleReference: setStyleRef, quality });
          illustrations[i].dataUri = img.dataUri;
          illustrations[i].status = "ready";
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          illustrations[i].status = "error";
          illustrations[i].error = message;
          // Surface the failure to the server log too — the cached `error` string is the only other
          // trace, and stdio hosts never see it. Without this, "illustration failed" reports are
          // un-diagnosable. Stderr in stdio mode is the standard channel for MCP server logs.
          console.error(
            `[doodleworks-mcp] render failed: set=${setId} illustration=${i} title=${JSON.stringify(illustrations[i].title)}: ${message}`,
          );
        }
      }
    },
  );
  await Promise.all(workers);
}

const aspectSchema = z.enum(["21:9", "16:9"]);
const resolutionSchema = z.enum(["1k", "2k"]);
const qualitySchema = z
  .enum(["low", "medium", "high", "auto"])
  .describe("Image quality (OpenAI). Lower is faster & cheaper. Defaults to DOODLEWORKS_QUALITY env or 'low'.");

const illustrationSchema = z.object({
  title: z.string().describe("Short illustration title."),
  archetype: z
    .string()
    .optional()
    .describe("Optional layout aid (secondary to the contraption metaphor): process | cycle | stack | taxonomy | matrix | timeline | decision | data-shape | summary."),
  aspect: aspectSchema.optional().describe("16:9 for every illustration (default). 21:9 is an optional wider hero illustration — not a titled cover."),
  prompt: z
    .string()
    .describe(
      "The contraption composition + Tinku's action + a 'Required text only:' block listing the exact English annotation words. " +
        "The server adds the Tinku character, the conceptual engine, and the house style automatically — do NOT restate them here.",
    ),
  styleReference: z
    .string()
    .optional()
    .describe(
      "Optional drawing-style reference for THIS illustration (style calibration only — never the character, layout, or text): " +
        "a library id from the style-reference library, a data-URI, or a local path. Overrides any set-wide styleReference.",
    ),
});

// Embed the bundled library ids in the schema description so the model can pick one without an
// extra doc:// fetch (not every host eagerly reads resources). Read once at module load — the
// directory doesn't change at runtime, so a restart is the right place to pick up new files.
const BUNDLED_STYLE_REF_IDS = listStyleReferencesSync().map((id) => id.replace(/\.[^.]+$/, ""));
const styleRefHint = BUNDLED_STYLE_REF_IDS.length
  ? ` Bundled ids you can pass directly (grouped by set prefix): ${BUNDLED_STYLE_REF_IDS.join(", ")}. ` +
    "For visual consistency with the project's existing sets, pick one — any id works for style calibration; " +
    "prefer one whose set prefix matches the topic if relevant."
  : "";

const styleReferenceField = z
  .string()
  .optional()
  .describe(
    "Optional drawing-style reference for the whole set (style calibration only — the clean even line weight, the " +
      "pure-white background, whitespace, restraint; NEVER the reference's character, layout, or text). Accepts a library id, a data-URI, " +
      "or a local path. Per-illustration styleReference wins; with none set (and no DOODLEWORKS_STYLE_REF env), " +
      "output is the engine's text-only style guidance." +
      styleRefHint,
  );

export function createServer(deps: { renderPage?: RenderPageFn } = {}): McpServer {
  const renderPage = deps.renderPage ?? defaultRenderPage;
  const server = new McpServer({
    name: "Doodleworks MCP",
    version: "1.0.0",
  });

  // ---- entry tool: plans nothing, renders the supplied illustrations, opens the viewer ----
  // The "page" vocabulary survives only in PageSpec (the engine interface) and renderPage (the
  // injectable dep). Everything user-visible — tool name, schema fields, _meta keys — speaks
  // "illustration" / "set" instead of "page" / "deck".
  registerAppTool(
    server,
    TOOL_CREATE_ILLUSTRATIONS,
    {
      title: "Create Tinku illustrations",
      description:
        "Render a set of single-idea, hand-drawn Tinku illustrations (each 16:9; an optional 21:9 hero) and open an " +
        "interactive viewer. Supply one entry per illustration; each `prompt` is a contraption composition + Tinku's " +
        "action + its exact English annotations — the server applies the Tinku character, the conceptual engine, and " +
        "the house style. Use this when the user wants hand-drawn illustrations for an article, post, or explainer.",
      inputSchema: {
        title: z.string().optional().describe("A title for the set."),
        illustrations: z
          .array(illustrationSchema)
          .min(1)
          // Cap the set so a single call (a buggy host, a typo, or a prompt-injected host
          // model) cannot enqueue an unbounded number of paid image renders against the
          // user's own API key. 10 is a generous bound above the README's 4-8 typical guidance.
          .max(10, "At most 10 illustrations per set.")
          .describe("Illustrations in order (1-10); each is 16:9 by default. An optional 21:9 hero may go first."),
        resolution: resolutionSchema.optional().describe("Size tier (default 1k; 2k is heavier for inline display)."),
        quality: qualitySchema.optional(),
        styleReference: styleReferenceField,
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async (args) => {
      const resolution = (args.resolution ?? "1k") as Resolution;
      const setStyleRef = args.styleReference;
      const quality = args.quality as Quality | undefined;
      const specs = args.illustrations as PageSpec[];

      // Create the set up front in a "pending" state, then render in the BACKGROUND so this tool
      // call returns immediately. A multi-image render can take minutes; blocking here would exceed
      // the host's per-request timeout and the call would be reported as timed out. The viewer
      // streams each illustration in via get_illustration as it becomes ready.
      const setId = randomUUID();
      const title = args.title ?? null;
      const illustrations: CachedIllustration[] = specs.map((p, index) => ({
        index,
        title: p.title,
        archetype: p.archetype,
        aspect: (p.aspect ?? "16:9") as Aspect,
        prompt: p.prompt,
        status: "pending" as const,
        styleReference: p.styleReference,
      }));
      rememberSet(setId, { title, illustrations, styleReference: setStyleRef, resolution, quality });
      // Fire-and-forget; errors are captured per illustration inside, and the final .catch is a
      // belt-and-braces guard so a background failure can never surface as an unhandled rejection.
      void renderSetInBackground(renderPage, setId, specs, resolution, setStyleRef, quality).catch(() => {});

      const titles = illustrations.map((p) => p.title).join(", ");
      return {
        // Model-visible: short and cheap. No image bytes here.
        content: [
          {
            type: "text" as const,
            text: `Rendering a set of ${illustrations.length} illustrations${
              args.title ? ` ("${args.title}")` : ""
            }: ${titles}. Opening the viewer — illustrations stream in as they finish; regenerate or download once they appear.`,
          },
        ],
        // Model-visible structured awareness, still no bytes.
        structuredContent: {
          title: args.title,
          illustrationCount: illustrations.length,
          illustrations: illustrations.map(({ index, title, archetype, aspect }) => ({ index, title, archetype, aspect })),
        },
        // View-only metadata. No image bytes — the View pulls each rendered illustration via
        // get_illustration so a single result stays well under the MCP size cap.
        _meta: {
          // Stamped so the viewer can detect a stale bundle precisely (see VIEWER_CONTRACT_VERSION).
          [META_CONTRACT_KEY]: { version: VIEWER_CONTRACT_VERSION },
          [META_SET_KEY]: {
            setId,
            title,
            illustrations: illustrations.map(({ index, title, archetype, aspect, prompt }) => ({
              index,
              title,
              archetype,
              aspect,
              prompt,
            })),
          },
        },
      };
    },
  );

  // ---- data tool: hand a single cached illustration's image to the viewer ----
  registerAppTool(
    server,
    TOOL_GET_ILLUSTRATION,
    {
      title: "Fetch one illustration",
      description:
        "Return the rendered image for one illustration of a previously created set. The viewer calls " +
        "this for each illustration after create_illustrations so a single tool result never carries the whole set.",
      inputSchema: {
        setId: z.string().describe("The setId returned by create_illustrations."),
        index: z.number().int().min(0).describe("Zero-based illustration index."),
      },
      // App-only: the viewer iframe calls this; we hide it from the model's tool list
      // so it doesn't show up as something the model would invoke directly.
      _meta: { ui: { visibility: ["app"] } },
    },
    async (args) => {
      const set = touchSet(args.setId);
      const illustration = set?.illustrations[args.index];
      if (!set || !illustration) {
        // Unknown set or index — e.g. the server restarted and dropped its in-memory cache.
        return {
          content: [{ type: "text" as const, text: "Illustration not found (unknown set or index — the set may have expired)." }],
          structuredContent: { ok: false, status: "missing" as const, index: args.index },
          _meta: {},
        };
      }
      if (illustration.status === "ready" && illustration.dataUri) {
        return {
          content: [{ type: "text" as const, text: `Illustration ${args.index} ready.` }],
          structuredContent: { ok: true, status: "ready" as const, index: args.index, aspect: illustration.aspect },
          _meta: {
            [META_ILLUSTRATION_KEY]: { index: args.index, aspect: illustration.aspect, dataUri: illustration.dataUri },
          },
        };
      }
      if (illustration.status === "error") {
        return {
          content: [{ type: "text" as const, text: `Illustration ${args.index} failed to render: ${illustration.error ?? "unknown error"}` }],
          structuredContent: { ok: false, status: "error" as const, index: args.index, error: illustration.error ?? "unknown error" },
          _meta: {},
        };
      }
      // Still rendering in the background — the viewer polls until ready.
      return {
        content: [{ type: "text" as const, text: `Illustration ${args.index} is still rendering.` }],
        structuredContent: { ok: false, status: "pending" as const, index: args.index },
        _meta: {},
      };
    },
  );

  // ---- data tool: re-render one illustration; called from inside the View (not UI-bound) ----
  registerAppTool(
    server,
    TOOL_REGENERATE_ILLUSTRATION,
    {
      title: "Regenerate one illustration",
      description:
        "Re-render a single illustration with the same (or a tweaked) prompt and aspect. Image models are " +
        "non-deterministic, so this yields a fresh take. Returns the new image in `_meta` for the viewer.",
      inputSchema: {
        title: z.string().optional(),
        archetype: z.string().optional(),
        aspect: aspectSchema.optional(),
        prompt: z.string().describe("The illustration composition + 'Required text only:' block (style is re-applied server-side)."),
        resolution: resolutionSchema.optional(),
        quality: qualitySchema.optional(),
        styleReference: styleReferenceField,
        setId: z.string().optional().describe("If present, also replace the cached image so a viewer reopen sees the regenerated illustration."),
        index: z.number().int().min(0).optional().describe("Required with setId — zero-based illustration index to replace."),
      },
      // App-only: the viewer iframe calls this and reads the returned _meta. Hidden from the
      // model so it isn't invoked directly (it has no UI binding of its own).
      _meta: { ui: { visibility: ["app"] } },
    },
    async (args) => {
      const aspect: Aspect = (args.aspect ?? "16:9") as Aspect;

      // Pull the cached set up front so we can recover the original style calibration. The viewer
      // doesn't know the set-wide or per-illustration styleReference, so without this a regen
      // drops it and the new image renders against the engine's env default (or nothing).
      // Explicit args still win.
      const cached = args.setId ? touchSet(args.setId) : undefined;
      const cachedIllustration =
        cached && args.index !== undefined && args.index >= 0 ? cached.illustrations[args.index] : undefined;
      const setStyleRef = args.styleReference ?? cached?.styleReference;
      const illustrationStyleRef = cachedIllustration?.styleReference;
      const resolution = ((args.resolution as Resolution | undefined) ?? cached?.resolution ?? "1k") as Resolution;
      const quality = (args.quality as Quality | undefined) ?? cached?.quality;

      const img = await renderPage(
        {
          title: args.title ?? "illustration",
          archetype: args.archetype,
          aspect,
          prompt: args.prompt,
          styleReference: illustrationStyleRef,
        },
        {
          resolution,
          styleReference: setStyleRef,
          quality,
        },
      );
      if (cachedIllustration) {
        cachedIllustration.dataUri = img.dataUri;
        cachedIllustration.aspect = aspect;
        cachedIllustration.prompt = args.prompt;
        cachedIllustration.status = "ready";
        cachedIllustration.error = undefined;
        if (args.title) cachedIllustration.title = args.title;
        if (args.archetype) cachedIllustration.archetype = args.archetype;
      }
      return {
        content: [{ type: "text" as const, text: "Regenerated the illustration." }],
        structuredContent: { aspect, ok: true },
        _meta: { [META_ILLUSTRATION_KEY]: { aspect, dataUri: img.dataUri } },
      };
    },
  );

  // ---- the View: bundled single-file HTML produced by `npm run build` ----
  registerAppResource(
    server,
    RESOURCE_URI,
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      const html = await loadViewerHtml();
      return { contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html }] };
    },
  );

  // ---- planning prompt: surfaces as /mcp__doodleworks-mcp__plan_illustrations ----
  // Embeds the contraption-metaphor planning rules so the host LLM produces a create_illustrations-ready
  // payload without a separate skill. Full detail lives in the doc:// resources below.
  server.registerPrompt(
    "plan_illustrations",
    {
      title: "Plan Tinku illustrations",
      description:
        "Turn a topic or source into a create_illustrations-ready set of single-idea Tinku illustrations: extract cognitive " +
        "anchors, reinvent each as a contraption Tinku operates, English annotations only, finishing with one create_illustrations call.",
      argsSchema: {
        topic: z.string().describe("The topic or source to illustrate (required)."),
        audience: z.string().optional().describe("Who it's for and what they already know."),
        count: z
          .string()
          .optional()
          .describe("Number of illustrations, as an integer. If omitted, propose 4–8."),
        spine: z
          .enum(SPINES)
          .optional()
          .describe("Narrative spine: teaching | persuasion | report | product | knowledge-card."),
      },
    },
    ({ topic, audience, count, spine }) => {
      const n = count ? Number.parseInt(count, 10) : Number.NaN;
      const countLine =
        Number.isFinite(n) && n >= 1
          ? `Plan exactly ${n} illustrations, each 16:9.`
          : "Plan 4–8 illustrations, each 16:9.";
      const audienceLine = audience?.trim()
        ? audience.trim()
        : "general — infer a sensible audience from the topic";
      const spineLine = spine
        ? spine
        : "infer from the topic (one of: teaching, persuasion, report, product, knowledge-card)";

      const text = [
        "You are planning a set of single-idea, hand-drawn Tinku illustrations for an article/post, and will finish",
        "by emitting a single create_illustrations call. Tinku is the app's recurring character: a small solid-black worker who",
        "physically OPERATES a contraption. The engine adds the Tinku character, the conceptual engine, and the house",
        "style automatically — so do NOT restate the style, the character, or the framing in any prompt.",
        "",
        `Topic / source: ${topic}`,
        `Audience: ${audienceLine}`,
        `Narrative spine: ${spineLine}`,
        countLine,
        "",
        "Plan with these rules:",
        "1. Read the source and extract distinct COGNITIVE ANCHORS — a judgment, a process, a structure, a state, or a",
        "   metaphor. One anchor per illustration. NEVER draw the topic literally.",
        "2. For each anchor, invent a low-tech, slightly grotesque but physically plausible CONTRAPTION (machine, rig,",
        "   or workshop scene) that Tinku is actively OPERATING by hand. Apply the erase-test: if Tinku could be removed",
        "   and the picture still made sense, it is too decorative — redraw so the idea only works because Tinku is doing",
        "   something to the contraption.",
        "3. Each illustration is 16:9 and carries exactly ONE core idea.",
        "4. Write each illustration's prompt as: a concrete description of the contraption + what Tinku is doing to it,",
        "   then a closing block exactly of the form: 'Required text only (render exactly, and NO other text anywhere in",
        "   the image): <the exact words>' followed by 'Do not add any other words, captions, labels, watermarks, or UI",
        "   text.' Annotations are terse English, handwritten in red/orange/blue; draw arrows/connectors as lines, never",
        "   typed characters.",
        "5. Composition archetypes (process, cycle, stack, taxonomy, matrix, timeline, decision, data-shape, summary) may",
        "   be used as a SECONDARY aid to lay out the contraption — but the contraption metaphor is primary. NEVER output",
        "   a literal chart, flowchart, or infographic.",
        "",
        "Examples of the move (NOT a fixed catalogue — invent your own per anchor):",
        "  - bottleneck -> Tinku hand-cranking a funnel that is far too narrow, items jamming above it",
        "  - compounding -> Tinku turning a crank that grows a snowball bigger on each loop of a little track",
        "  - technical debt -> Tinku straining to hold up a teetering tower of patched-together boxes with one stick",
        "  - context-switching -> Tinku frantically re-plugging cables into different sockets, dropping things mid-swap",
        "  - single source of truth -> Tinku drawing from one labelled tank that feeds a row of taps",
        "  - premature optimisation -> Tinku lovingly polishing one gear to a shine while the rest of the machine sits unbuilt",
        "",
        "Need more detail? Read these resources: doc://doodleworks/intake, doc://doodleworks/concept-engine,",
        "doc://doodleworks/composition-patterns, doc://doodleworks/prompt-patterns, doc://doodleworks/visual-dna,",
        "doc://doodleworks/output-quality.",
        "",
        "Finish by emitting the JSON arguments object for ONE create_illustrations call, shaped like:",
        '{ "title": "...", "styleReference": "<id from the create_illustrations schema>", "resolution": "1k", "illustrations": [',
        '  { "title": "...", "archetype": "...", "aspect": "16:9", "prompt": "..." }',
        "] }",
        "Including `styleReference` calibrates the linework to the project's house style — pick any bundled id listed",
        "in the create_illustrations schema (prefer one whose set prefix matches the topic if relevant). Every",
        "illustration is 16:9 (an optional 21:9 hero is allowed; there is no cover). Then call create_illustrations",
        "with that object.",
      ].join("\n");

      return { messages: [{ role: "user", content: { type: "text" as const, text } }] };
    },
  );

  // ---- doc:// resources: the bundled planning knowledge, readable by any host ----
  for (const doc of REFERENCE_DOCS) {
    const uri = `doc://doodleworks/${doc.name}`;
    server.registerResource(
      doc.name,
      uri,
      { title: doc.title, description: doc.description, mimeType: "text/markdown" },
      async () => {
        const text = await fs.readFile(path.join(REFERENCES_DIR, `${doc.name}.md`), "utf-8");
        return { contents: [{ uri, mimeType: "text/markdown", text }] };
      },
    );
  }

  // ---- doc:// resource: the available style-reference ids (discovered at runtime) ----
  const styleRefsUri = "doc://doodleworks/style-references";
  server.registerResource(
    "style-references",
    styleRefsUri,
    {
      title: "Style-reference library",
      description:
        "The drawing-style reference ids available to pass as styleReference (style calibration only — not " +
        "composition templates, and not the source of the Tinku character).",
      mimeType: "text/markdown",
    },
    async () => {
      const ids = await listStyleReferences();
      const list = ids.length
        ? ids.map((id) => `- \`${id}\``).join("\n")
        : "_No references bundled yet. Drop image files into `assets/style-references/` to populate the library._";
      const text =
        "# Style-reference library\n\n" +
        "These images calibrate the DRAWING STYLE ONLY — the clean even line weight, the pure-white background, " +
        "whitespace, and restraint. They are **not** composition templates and **not** the source of the Tinku " +
        "character. Pass an id below as `styleReference` on `create_illustrations`/`regenerate_illustration`, or set the " +
        "`DOODLEWORKS_STYLE_REF` environment variable.\n\n" +
        "## Available ids\n\n" +
        list +
        "\n";
      return { contents: [{ uri: styleRefsUri, mimeType: "text/markdown", text }] };
    },
  );

  return server;
}

// Always serve the latest build. We stat the bundle on each request (cheap) and only re-read it
// when its mtime changes, so an unchanged file still avoids a disk read — but a rebuild during a
// long-lived stdio session reaches the host instead of being masked by a first-read memo. (Without
// this, the server keeps serving whatever viewer build it first read, so `npm run build` never
// reaches the viewer until the whole MCP process restarts.)
let cachedViewerHtml: { mtimeMs: number; html: Promise<string> } | undefined;
async function loadViewerHtml(): Promise<string> {
  const file = path.join(DIST_DIR, "mcp-app.html");
  const stat = await fs.stat(file).catch(() => undefined);
  if (!stat) {
    throw new Error(
      `Viewer bundle not found at ${file}. Run \`pnpm run build\` to create it, then restart the host.`,
    );
  }
  const { mtimeMs } = stat;
  if (!cachedViewerHtml || cachedViewerHtml.mtimeMs !== mtimeMs) {
    const html = fs.readFile(file, "utf-8").catch((err) => {
      cachedViewerHtml = undefined; // don't pin a rejected read — let the next request retry
      throw err;
    });
    cachedViewerHtml = { mtimeMs, html };
  }
  return cachedViewerHtml.html;
}
