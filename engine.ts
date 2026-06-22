/**
 * engine.ts — image generation for the Doodleworks MCP App.
 *
 * A TypeScript port of the skill's generate.py core: provider auto-detection,
 * exact aspect sizing, and the hand-drawn style lock applied to every page.
 *
 * Providers (auto-detected from env, override with `provider`):
 *   - OpenAI GPT Image 2  (default)  -> OPENAI_API_KEY
 *   - Google Gemini (Nano Banana Pro) -> GEMINI_API_KEY or GOOGLE_API_KEY
 *
 * Everything runs server-side. The API key and the style-reference image are read
 * from the environment / disk and are NEVER passed to the View / iframe.
 */

import OpenAI, { toFile } from "openai";
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs/promises";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Aspect } from "./types.js";

export type { Aspect };
export type Resolution = "1k" | "2k";
export type Provider = "openai" | "gemini";
/** OpenAI image quality. Lower is faster and cheaper; the model's own default leans slow/high. */
export type Quality = "low" | "medium" | "high" | "auto";

/**
 * Aspect -> [width, height]. Both divisible by 16, kept inside 1:3..3:1, and
 * under 2560x1440 — the constraints `gpt-image-2` accepts as arbitrary sizes.
 * `gpt-image-1` only supports 1024x1024 / 1536x1024 / 1024x1536, so widescreen
 * pages REQUIRE the gpt-image-2 default below.
 */
const SIZES: Record<Resolution, Record<Aspect, [number, number]>> = {
  "1k": { "16:9": [1536, 864], "21:9": [1792, 768] },
  "2k": { "16:9": [2048, 1152], "21:9": [2240, 960] },
};

const DEFAULT_OPENAI_MODEL = "gpt-image-2";
const DEFAULT_GEMINI_MODEL = "gemini-3-pro-image-preview";

/**
 * The Tinku house style, applied to every illustration so an independently generated
 * set still reads as one coherent body of work. Mirrors references/visual-dna.md.
 *
 * Trimmed of overlap with TINKU_CHARACTER (which already locks the figure to matte black),
 * TEXT_POLICY (handwritten English annotations), the role line (16:9), and CONCEPT_ENGINE
 * (single core idea = contraption Tinku operates) — those guards held by the other blocks.
 */
export const STYLE_LOCK =
  "Clean vector-style line illustration on a PURE WHITE background — no paper texture, " +
  "beige, shadows, or gradients. CONFIDENT, SMOOTH black outlines of even, consistent " +
  "weight (like clean ink or a vector stroke) — deliberate and tidy, NOT sketchy, wobbly, " +
  "pencil, hatched, scribbled, or roughly shaded. Solid flat fills. Restrained flat accents " +
  "in red, orange, and blue only. Crisp shapes with clean curves and tidy geometry. Lots of " +
  "white space; the subject fills about 50-70% of the frame. Polished editorial illustration " +
  "— clean and modern, NOT a rough sketch, NOT a corporate infographic, NOT cute/kawaii/chibi, " +
  "NOT an emoji or mascot sticker.";

/**
 * Compact style guard used when a style-reference image is attached: the image itself encodes
 * the linework, palette, and whitespace, so we only restate the strongest "what NOT to do"
 * guards. This is the single biggest prompt-size win for reference-conditioned renders.
 */
const STYLE_LOCK_MINIMAL =
  "Match the reference's drawing style. PURE WHITE background. Solid flat fills only. " +
  "Restrained flat accents in red, orange, and blue only. NOT sketchy, NOT wobbly, NOT " +
  "cute/kawaii/chibi, NOT an emoji or mascot sticker.";

/**
 * Tinku — the app's OWN recurring character and the single source of truth for the
 * figure. Tinku's appearance comes ONLY from this constant: it is never derived from a
 * third-party character or from the style-reference images (tasks 7–8), which calibrate
 * drawing style only. Edit this constant to restyle the character.
 */
export const TINKU_CHARACTER =
  "Tinku is the app's own original character: a small, solid matte-black ink worker with ONE simple, always-repeatable build. " +
  "BODY (never vary this): his whole body is ONE continuous solid matte-black egg/teardrop blob, slightly taller than wide " +
  "(about 1.3 to 1), with NO neck, NO separate head, and NO chest, waist, or belly division — the head and the body are the " +
  "SAME single mass. He is never a little person, never a rubber-hose mascot, never a robot, and never segmented into " +
  "head-plus-torso. FILL AND LINE: the whole blob is filled flat solid matte black and drawn with the same clean, even black " +
  "line as the rest of the page (deliberate and tidy, never sketchy or wobbly). FACE, set high on the mass: EXACTLY two large " +
  "round white eyes with small dark pupils, expressive and reactive — they widen, squint, or strain with the effort of the " +
  "task; and ONE small simple mouth — a short curved line at rest that opens or grits only when he strains. No separate " +
  "eyebrows (let the eye shape carry the expression), no nose, no ears, no other facial marks. CROWN: EXACTLY three short, " +
  "straight ink sprigs standing up on the crown — always present, always three, never two, never curled, never a full head of " +
  "hair, and never bald. LIMBS: EXACTLY two short, slightly tapering arms set high on the blob — each about half the body " +
  "height, never long or thin — each ending in ONE rounded mitten-hand with no separate fingers; and EXACTLY two short stubby " +
  "legs, slightly splayed for a planted stance. Never a third arm or leg, never duplicated, forked, or branching limbs, never " +
  "an extra hand, and never a pointing finger. Because he is a solid black shape, keep his arms and legs simple and " +
  "well-separated so they never merge into each other, into a tangle, or into the contraption he is operating. He is " +
  "genderless, culture-neutral, with no logos or text on him. ROLE: Tinku is NEVER a mascot, sticker, or corner decoration — " +
  "he is the absurd worker physically OPERATING the contraption that embodies the article's idea, leaning, straining, " +
  "gripping, cranking. Test: if you could erase Tinku and the picture still made complete sense on its own, he was merely " +
  "decorative and the composition has failed — redraw it so the idea only works because he is doing something to it. At most " +
  "one Tinku per scene, drawn small so the contraption and the whitespace dominate the frame.";

/**
 * The conceptual engine — the distinctive move. Appended to every prompt so the image is
 * a contraption Tinku operates, never a literal picture of the topic. Mirrors
 * references/concept-engine.md.
 *
 * The erase-test is intentionally NOT restated here — TINKU_CHARACTER already carries it
 * verbatim ("Test: if you could erase Tinku and the picture still made complete sense..."),
 * and doubling it ate ~70 tokens per render.
 */
export const CONCEPT_ENGINE =
  "Do NOT illustrate the topic literally. Take ONE cognitive anchor from the source — a judgment, " +
  "a process, a structure, a state, or a metaphor — and reinvent it as a low-tech, slightly " +
  "grotesque but physically plausible contraption Tinku is actively OPERATING by hand. Abstract " +
  "claims become little machines Tinku runs.";

/**
 * Text policy appended to every prompt (English-only, task 4). The page's
 * "Required text only:" block is the sole permitted text.
 */
const TEXT_POLICY =
  "All on-image text is ENGLISH ONLY, rendered as a few small HANDWRITTEN annotations in restrained " +
  "red, orange, or blue. The page's \"Required text only:\" block lists the only words allowed in the " +
  "image — render exactly those and no other words, captions, labels, watermarks, or UI text. Draw " +
  "arrows and connectors as clean drawn lines, never typed characters, and never reproduce text or " +
  "non-English characters from any style-reference image.";

/**
 * Conditioning directive added when a style-reference image is supplied (task 5).
 * The reference steers DRAWING STYLE only — never the character, composition, or text.
 */
const STYLE_REFERENCE_CONDITIONING =
  "A style-reference image is attached. Use it ONLY to calibrate the drawing style — the clean, even " +
  "line weight, the pure-white background, the amount of whitespace, and overall restraint. Draw the " +
  "contraption described above and Tinku exactly as specified, in English. Do NOT copy the reference's " +
  "subject, character, layout, or composition, and do NOT reproduce any text or non-English characters from it.";

export interface PageSpec {
  title: string;
  archetype?: string;
  aspect?: Aspect;
  /** Composition + "Required text only:" block. The style lock is added here. */
  prompt: string;
  /**
   * Optional drawing-style reference (style calibration only, never character/layout/text):
   * a library id (a filename in assets/style-references/), a data-URI, or a local file path.
   * Overrides RenderOptions.styleReference for this page.
   */
  styleReference?: string;
}

export interface RenderOptions {
  resolution?: Resolution;
  provider?: Provider;
  model?: string;
  /**
   * Deck-wide drawing-style reference (style calibration only). A library id, a data-URI,
   * or a local path. Per-page PageSpec.styleReference takes precedence; if neither is set
   * the env default DOODLEWORKS_STYLE_REF is used; with none set, behaviour is exactly as before.
   */
  styleReference?: string;
  /**
   * OpenAI image quality (low | medium | high | auto). Lower renders faster and cheaper.
   * Defaults to the env DOODLEWORKS_QUALITY, else "low". Ignored by the Gemini provider.
   */
  quality?: Quality;
}

export interface RenderedImage {
  dataUri: string;
  mimeType: string;
  width: number;
  height: number;
}

// ---- style-reference library (extensible; discovered at runtime, no hardcoded list) ----

/** The library lives next to the engine so it ships with the app and is found via stdio/HTTP alike. */
const STYLE_REF_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "assets", "style-references");

const IMAGE_EXT_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function extForMime(mimeType: string): string {
  for (const [ext, mime] of Object.entries(IMAGE_EXT_MIME)) {
    if (mime === mimeType) return ext.slice(1);
  }
  return "png";
}

interface ResolvedReference {
  base64: string;
  mimeType: string;
  /** Where it came from (library id / data-uri / path) — for logs, never sent to the View. */
  source: string;
}

/**
 * List the available style-reference ids (image filenames in assets/style-references/).
 * Returns [] if the directory is absent or empty — so callers degrade gracefully.
 */
export async function listStyleReferences(): Promise<string[]> {
  try {
    const entries = await fs.readdir(STYLE_REF_DIR, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && IMAGE_EXT_MIME[path.extname(e.name).toLowerCase()] !== undefined)
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * Sync mirror of listStyleReferences — used at module load to embed bundled ids into the
 * create_illustrations schema description, so the model can pick one without an async lookup or a doc://
 * fetch (not every host eagerly reads doc resources).
 */
export function listStyleReferencesSync(): string[] {
  try {
    const entries = readdirSync(STYLE_REF_DIR, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && IMAGE_EXT_MIME[path.extname(e.name).toLowerCase()] !== undefined)
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

function parseDataUri(value: string): ResolvedReference {
  // RFC 2397 allows zero or more `;param=value` attributes between the mime and the payload
  // (e.g. `data:image/png;charset=utf-8;base64,...`). The earlier `(;base64)?` regex rejected
  // anything other than `;base64`, so otherwise-valid data URIs failed to parse.
  const match = /^data:([^;,]+)?((?:;[^,]+)*),(.*)$/s.exec(value);
  if (!match) throw new Error("Invalid data-URI style reference.");
  const mimeType = match[1] || "image/png";
  const params = match[2] || "";
  const payload = match[3];
  const isBase64 = /(?:^|;)base64(?:$|;)/.test(params);
  if (isBase64) return { base64: payload, mimeType, source: "data-uri" };
  // Non-base64 payload: each `%XX` is one raw byte (RFC 2397). Decode straight to bytes
  // rather than via `decodeURIComponent(...).toString("base64")` — decodeURIComponent collapses
  // a UTF-8 sequence like `%E4%B8%AD` into ONE JS code point, then Buffer would re-encode it
  // as a multi-byte UTF-8 sequence, corrupting the image. (src/download-util.ts has the same
  // bug-warning for the browser side; this is the Node mirror.)
  const bytes: number[] = [];
  for (let i = 0; i < payload.length; i++) {
    const ch = payload[i];
    if (ch === "%" && i + 2 < payload.length) {
      const byte = parseInt(payload.slice(i + 1, i + 3), 16);
      if (Number.isNaN(byte)) throw new Error("Invalid data-URI percent-escape.");
      bytes.push(byte);
      i += 2;
    } else {
      const code = payload.charCodeAt(i);
      if (code > 0xff) throw new Error("Invalid data-URI: unencoded non-Latin-1 character.");
      bytes.push(code);
    }
  }
  return { base64: Buffer.from(bytes).toString("base64"), mimeType, source: "data-uri" };
}

async function readImageFile(absPath: string, source: string): Promise<ResolvedReference> {
  const buf = await fs.readFile(absPath);
  const mimeType = IMAGE_EXT_MIME[path.extname(absPath).toLowerCase()] ?? "image/png";
  return { base64: buf.toString("base64"), mimeType, source };
}

/**
 * Resolve a style reference to raw image bytes. Accepts (in priority order) an explicit
 * value, else the env default DOODLEWORKS_STYLE_REF. The value may be a data-URI, a library
 * id (bare filename, with or without extension), or a local path. Returns null when nothing
 * is configured — the no-reference path renders exactly as before.
 *
 * Trust split: tool-supplied paths are SANDBOXED to assets/style-references/ (a prompt-injected
 * model could otherwise point styleReference at ~/.ssh/id_rsa or ~/.aws/credentials, and the
 * bytes would be base64-encoded into the prompt sent to the image API — silent exfiltration).
 * The env default is operator-controlled and may point anywhere on disk.
 */
export async function resolveStyleReference(ref?: string): Promise<ResolvedReference | null> {
  const explicit = (ref ?? "").trim();
  if (explicit) return resolveStyleRefValue(explicit, false);
  const fromEnv = (process.env.DOODLEWORKS_STYLE_REF ?? "").trim();
  if (fromEnv) return resolveStyleRefValue(fromEnv, true);
  return null;
}

async function resolveStyleRefValue(
  value: string,
  trustedPath: boolean,
): Promise<ResolvedReference | null> {
  if (value.startsWith("data:")) return parseDataUri(value);

  // A bare filename (no separators) is treated as a library id.
  if (!value.includes("/") && !value.includes("\\") && !path.isAbsolute(value)) {
    const ids = await listStyleReferences();
    const match =
      ids.find((id) => id === value) ?? ids.find((id) => id.replace(/\.[^.]+$/, "") === value);
    if (match) return readImageFile(path.join(STYLE_REF_DIR, match), `library:${match}`);
  }

  // Otherwise treat it as a local file path.
  const abs = path.isAbsolute(value) ? value : path.resolve(value);
  if (!trustedPath) {
    // Untrusted (tool-supplied) paths must resolve inside the style-reference library.
    const root = path.resolve(STYLE_REF_DIR);
    const rel = path.relative(root, abs);
    if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new Error(
        `Style reference "${value}" must be a library id, a data-URI, or a file inside assets/style-references/.`,
      );
    }
  }
  try {
    return await readImageFile(abs, `path:${abs}`);
  } catch {
    throw new Error(
      `Style reference "${value}" is not a known library id, a data-URI, or a readable file path.`,
    );
  }
}

/** Pick the provider from an explicit override or the environment. */
export function pickProvider(override?: Provider): Provider {
  if (override) return override;
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return "gemini";
  throw new Error(
    "No image API key found. Set OPENAI_API_KEY (OpenAI) or GEMINI_API_KEY / " +
      "GOOGLE_API_KEY (Gemini) in the server's environment.",
  );
}

const QUALITIES: readonly Quality[] = ["low", "medium", "high", "auto"];
// "low" is the default because line art barely shows the loss vs medium/high but renders 3-5x
// faster. Lift via DOODLEWORKS_QUALITY=medium|high|auto when texture/shading matters.
const DEFAULT_QUALITY: Quality = "low";

/**
 * Resolve the OpenAI image quality: an explicit value wins, else the env default
 * DOODLEWORKS_QUALITY (ignored if not a valid value), else "low". Lower quality is much
 * faster and cheaper; the model's own default leans slow/high.
 */
export function resolveQuality(explicit?: Quality): Quality {
  if (explicit) return explicit;
  const env = process.env.DOODLEWORKS_QUALITY;
  if (env && (QUALITIES as readonly string[]).includes(env)) return env as Quality;
  return DEFAULT_QUALITY;
}

/**
 * Assemble the full prompt: an aspect-keyed role line + the caller's contraption
 * composition + the Tinku character + the conceptual engine + the house style + the
 * English-only text policy, plus the style-reference conditioning when one is in play.
 * No cover/body deck framing — every image is a single-idea 16:9 illustration.
 */
export function buildPrompt(page: PageSpec, opts: { styleConditioned?: boolean } = {}): string {
  const aspect: Aspect = page.aspect ?? "16:9";
  const role =
    aspect === "21:9"
      ? "A single wide 16:9-style hero illustration."
      : "A single 16:9 clean line in-article illustration.";
  // With a reference image attached, the reference carries the linework/palette/whitespace,
  // so emit the compact lock instead of the full one — biggest single prompt-size lever, and
  // the reference is the higher-fidelity signal anyway.
  const styleLock = opts.styleConditioned ? STYLE_LOCK_MINIMAL : STYLE_LOCK;
  const parts = [role, page.prompt.trim(), TINKU_CHARACTER, CONCEPT_ENGINE, styleLock, TEXT_POLICY];
  if (opts.styleConditioned) parts.push(STYLE_REFERENCE_CONDITIONING);
  return parts.join("\n\n");
}

/** True for transient failures worth retrying — 429, 5xx, or a network error with no HTTP status. */
function isRetryable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const status = (err as { status?: number }).status;
  if (status === undefined) return true;
  return status === 429 || status >= 500;
}

/**
 * Throw a non-retryable error: pinning `status = 400` makes isRetryable() return false, so
 * withRetries() bails immediately instead of paying 3 retries for a permanent failure
 * (safety block, invalid prompt, bad key).
 */
function nonRetryableError(message: string): Error {
  return Object.assign(new Error(message), { status: 400 });
}

/**
 * Pull a Retry-After hint off an SDK error. Returns ms until we may retry, or null when the
 * server didn't send one. Handles both formats RFC 7231 allows: delta-seconds ("2") and
 * HTTP-date ("Wed, 21 Oct 2025 07:28:00 GMT"). Clamped to a 60s ceiling so a misconfigured
 * server can't park us indefinitely.
 */
function getRetryAfterMs(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const getHeader = (h: unknown): string | null => {
    if (!h || typeof h !== "object") return null;
    const obj = h as { get?: (k: string) => string | null } & Record<string, unknown>;
    if (typeof obj.get === "function") return obj.get("retry-after");
    const v = obj["retry-after"] ?? obj["Retry-After"];
    return typeof v === "string" ? v : null;
  };
  const e = err as { headers?: unknown; response?: { headers?: unknown } };
  const raw = getHeader(e.headers) ?? getHeader(e.response?.headers);
  if (!raw) return null;
  const MAX = 60_000;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX);
  const ts = Date.parse(raw);
  if (!Number.isNaN(ts)) {
    const delta = ts - Date.now();
    return delta > 0 ? Math.min(delta, MAX) : 0;
  }
  return null;
}

async function withRetries<T>(fn: () => Promise<T>, tries = 3, baseDelayMs = 2000): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (attempt === tries - 1 || !isRetryable(err)) break;
      // Honor Retry-After when the server sends one (typically on 429): a fixed 2s/4s
      // backoff often retries too early and triggers another 429, or sits idle past the
      // window the quota has already freed up. Falls back to exponential when absent.
      const retryAfter = getRetryAfterMs(err);
      const delay = retryAfter ?? baseDelayMs * 2 ** attempt;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw last;
}

async function generateOpenAI(
  fullPrompt: string,
  size: [number, number],
  model: string,
  reference: ResolvedReference | null,
  quality: Quality,
): Promise<RenderedImage> {
  const client = new OpenAI(); // reads OPENAI_API_KEY
  const [w, h] = size;
  return withRetries(async () => {
    // With a reference we condition via images.edit (reference as the input image); without
    // one we generate from scratch. Both keep the exact width×height sizing.
    const resp = reference
      ? await client.images.edit({
          model,
          image: await toFile(Buffer.from(reference.base64, "base64"), `style-reference.${extForMime(reference.mimeType)}`, {
            type: reference.mimeType,
          }),
          prompt: fullPrompt,
          size: `${w}x${h}`,
          quality,
        })
      : await client.images.generate({
          model,
          prompt: fullPrompt,
          size: `${w}x${h}`,
          quality,
        });
    const b64 = resp.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI response had no b64_json image data.");
    return { dataUri: `data:image/png;base64,${b64}`, mimeType: "image/png", width: w, height: h };
  });
}

async function generateGemini(
  fullPrompt: string,
  aspect: Aspect,
  size: [number, number],
  model: string,
  reference: ResolvedReference | null,
): Promise<RenderedImage> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  const [w, h] = size;
  // With a reference, attach it as an inlineData Part alongside the text prompt; otherwise
  // pass the prompt string as before.
  const contents = reference
    ? [{ inlineData: { mimeType: reference.mimeType, data: reference.base64 } }, { text: fullPrompt }]
    : fullPrompt;
  return withRetries(async () => {
    const resp = await ai.models.generateContent({
      model,
      contents,
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: aspect },
      },
    });
    const parts = resp.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      const inline = part.inlineData;
      if (inline?.data) {
        const mimeType = inline.mimeType ?? "image/png";
        return { dataUri: `data:${mimeType};base64,${inline.data}`, mimeType, width: w, height: h };
      }
    }
    // No image part — Gemini blocks usually come back as a 200 with a `blockReason` or a
    // non-STOP `finishReason` rather than an HTTP error. Surface the reason so the viewer
    // can show "rejected for safety" instead of the un-actionable "no image part".
    const blockReason = resp.promptFeedback?.blockReason as string | undefined;
    const finishReason = resp.candidates?.[0]?.finishReason as string | undefined;
    const SAFETY_BLOCKS = ["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "IMAGE_SAFETY", "SPII"];
    if (blockReason) {
      throw nonRetryableError(`Gemini blocked the prompt (${blockReason}). Try rewording the contraption description.`);
    }
    if (finishReason && SAFETY_BLOCKS.includes(finishReason)) {
      throw nonRetryableError(`Gemini blocked the response for safety (${finishReason}). Try rewording the contraption description.`);
    }
    if (finishReason && finishReason !== "STOP") {
      // MAX_TOKENS / RECITATION / OTHER — could be transient, leave retryable.
      throw new Error(`Gemini stopped early (${finishReason}) without producing an image.`);
    }
    throw new Error("Gemini response contained no image part.");
  });
}

/** Render one page to a data-URI PNG. */
export async function renderPage(page: PageSpec, opts: RenderOptions = {}): Promise<RenderedImage> {
  const aspect: Aspect = page.aspect ?? "16:9";
  const resolution: Resolution = opts.resolution ?? "1k";
  const size = SIZES[resolution][aspect];
  const provider = pickProvider(opts.provider);

  // Per-page reference wins over the deck-wide option, which wins over the env default.
  const reference = await resolveStyleReference(page.styleReference ?? opts.styleReference);
  const fullPrompt = buildPrompt(page, { styleConditioned: reference !== null });

  if (provider === "openai") {
    const quality = resolveQuality(opts.quality);
    return generateOpenAI(fullPrompt, size, opts.model ?? DEFAULT_OPENAI_MODEL, reference, quality);
  }
  // Gemini has no comparable quality knob; opts.quality is ignored for that provider.
  return generateGemini(fullPrompt, aspect, size, opts.model ?? DEFAULT_GEMINI_MODEL, reference);
}
