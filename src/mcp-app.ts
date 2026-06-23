import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import {
  META_ILLUSTRATION_KEY,
  META_SET_KEY,
  TOOL_GET_ILLUSTRATION,
  TOOL_REGENERATE_ILLUSTRATION,
  type Illustration,
  type IllustrationSet,
} from "../types.js";
import { dataUriToBlob } from "./download-util.js";

type IllustrationStatus = "pending" | "ready" | "error" | "expired" | "timeout";

// --- element refs ---
const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
};
const titleEl = $<HTMLSpanElement>("set-title");
const progressEl = $<HTMLSpanElement>("progress");
const counterEl = $<HTMLSpanElement>("counter");
const emptyEl = $<HTMLSpanElement>("empty");
const frameEl = $<HTMLDivElement>("frame");
const imgEl = $<HTMLImageElement>("page-img");
const skeletonEl = $<HTMLDivElement>("skeleton");
const pageErrorEl = $<HTMLDivElement>("page-error");
const pageErrorMsgEl = $<HTMLSpanElement>("page-error-msg");
const retryBtn = $<HTMLButtonElement>("retry");
const captionEl = $<HTMLDivElement>("caption");
const regenOverlayEl = $<HTMLDivElement>("regen-overlay");
const statusEl = $<HTMLDivElement>("status");
const stripEl = $<HTMLDivElement>("strip");
const prevBtn = $<HTMLButtonElement>("prev");
const nextBtn = $<HTMLButtonElement>("next");
const regenBtn = $<HTMLButtonElement>("regen");
const zoomBtn = $<HTMLButtonElement>("zoom-btn");
const dlBtn = $<HTMLButtonElement>("dl");
const dlAllBtn = $<HTMLButtonElement>("dl-all");
const burnTitleEl = $<HTMLInputElement>("burn-title");
const zoomEl = $<HTMLDivElement>("zoom");
const zoomImgEl = $<HTMLImageElement>("zoom-img");
const zoomCloseBtn = $<HTMLButtonElement>("zoom-close");

// --- state ---
let set: IllustrationSet | null = null;
let current = 0;
// View-side render lifecycle per illustration (separate from the cached dataUri), so a
// failed/expired/slow illustration can be shown in the stage with a Retry instead of a perpetual "Loading…".
const illustrationStatus = new Map<number, IllustrationStatus>();
// The server attaches a real reason on `structuredContent.error` (rate limit, content policy,
// network, key) — keep it per-index so renderStage can surface a useful message instead of the
// generic "failed to render."
const illustrationErrors = new Map<number, string>();
const regenerating = new Set<number>();
// Thumbnail cells, built once per set and updated in place (rebuilding on every poll flickered
// the strip and reset its scroll position).
const thumbCells = new Map<number, { btn: HTMLButtonElement; media: HTMLDivElement }>();

// Bounded background loads, matching the server's render concurrency.
const LAZY_CONCURRENCY = 3;
// The server renders illustrations in the background, so one may not be ready on the first fetch
// — poll until it is. ~2.5s × 160 ≈ a 6-7 minute ceiling per illustration (well beyond any real render).
const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 160;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
// Dedupes overlapping fetches of the same illustration.
const inFlight = new Map<number, Promise<void>>();

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Classify a raw image-API error into something the user can act on. The probes target the
// concrete shapes OpenAI and Gemini actually emit (codes, status strings, finish reasons,
// SDK message prefixes). Order matters — safety wins over rate-limit, quota wins over auth —
// so the most actionable hint surfaces first. Falls back to a truncated raw message so
// unfamiliar errors are still legible.
function humanizeError(msg: string): string {
  const m = msg.toLowerCase();

  // Safety / content policy.
  //   OpenAI: code `content_policy_violation`, type `image_generation_user_error`,
  //           message "Your request was rejected as a result of our safety system…"
  //   Gemini: blockReason / finishReason in SAFETY, PROHIBITED_CONTENT, BLOCKLIST,
  //           IMAGE_SAFETY, SPII — wrapped by engine.ts as "Gemini blocked the prompt (…)".
  if (
    m.includes("content_policy") ||
    m.includes("safety system") ||
    m.includes("image_generation_user_error") ||
    m.includes("prohibited_content") ||
    m.includes("blocklist") ||
    m.includes("image_safety") ||
    m.includes("moderation") ||
    m.includes("blocked the prompt") ||
    m.includes("blocked the response") ||
    (m.includes("blocked") && m.includes("safety"))
  ) {
    return "The image model rejected this prompt as unsafe — try rewording the contraption description and regenerating.";
  }

  // Quota / billing.
  //   OpenAI: code `insufficient_quota`, `billing_hard_limit_reached`,
  //           message "You exceeded your current quota…"
  //   Gemini: 429 RESOURCE_EXHAUSTED, "Resource has been exhausted (e.g. check quota)."
  if (
    m.includes("insufficient_quota") ||
    m.includes("billing_hard_limit") ||
    m.includes("exceeded your current quota") ||
    m.includes("quota exceeded") ||
    m.includes("check quota") ||
    m.includes("hard limit") ||
    m.includes("billing") ||
    m.includes("credit")
  ) {
    return "The image API key has hit its quota or run out of credit — check your plan & billing.";
  }

  // Rate limit.
  //   OpenAI: code `rate_limit_exceeded`, "Rate limit reached for <model> in organization…"
  //   Gemini: 429 RESOURCE_EXHAUSTED with no "quota" phrasing.
  if (
    m.includes("rate_limit") ||
    m.includes("rate limit") ||
    m.includes("resource_exhausted") ||
    m.includes("resource has been exhausted") ||
    m.includes("too many requests") ||
    // Digit-delimited so an unrelated "429" inside a model id, request id, or pixel
    // dimension can't masquerade as a rate-limit and loop the user on a permanent error.
    /(?<![0-9])429(?![0-9])/.test(m)
  ) {
    return "The image API is rate-limited — try Regenerate again in a moment.";
  }

  // Auth / permissions.
  //   OpenAI: 401 `invalid_api_key`, "Incorrect API key provided"; 403 PermissionDenied.
  //   Gemini: 400 INVALID_ARGUMENT "API key not valid", `API_KEY_INVALID`,
  //           `API_KEY_EXPIRED`, 401 UNAUTHENTICATED, 403 PERMISSION_DENIED.
  if (
    m.includes("invalid_api_key") ||
    m.includes("incorrect api key") ||
    m.includes("api_key_invalid") ||
    m.includes("api_key_expired") ||
    m.includes("api key not valid") ||
    m.includes("api key expired") ||
    m.includes("unauthenticated") ||
    m.includes("permission_denied") ||
    m.includes("permission denied") ||
    m.includes("unauthorized") ||
    m.includes("authentication") ||
    m.includes(" 401 ") || m.includes("401:") ||
    m.includes(" 403 ") || m.includes("403:")
  ) {
    return "The image API key is missing, invalid, or expired.";
  }

  // Model / config error.
  //   OpenAI: code `model_not_found`, "The model `gpt-image-2` does not exist or you do
  //           not have access to it.", `invalid_request_error` on size/quality/format.
  //   Gemini: 404 NOT_FOUND, "models/<name> is not found".
  if (
    m.includes("model_not_found") ||
    m.includes("model does not exist") ||
    m.includes("do not have access to") ||
    m.includes("does not exist or you do not have access") ||
    m.includes("is not found for api version") ||
    m.includes("invalid value for") ||
    m.includes("invalid_request_error")
  ) {
    return "The image model name or request shape isn't supported by your provider — check DOODLEWORKS model/size/quality settings.";
  }

  // Server-side / upstream failure (post-retry surrender).
  //   OpenAI: 500 `server_error`, "The server had an error processing your request."
  //   Gemini: 500 INTERNAL, 503 UNAVAILABLE.
  if (
    m.includes("server had an error") ||
    m.includes("server_error") ||
    m.includes("internal server error") ||
    m.includes("unavailable") ||
    m.includes(" 500 ") || m.includes("500:") ||
    m.includes(" 502 ") || m.includes("502:") ||
    m.includes(" 503 ") || m.includes("503:")
  ) {
    return "The image API had a server error — likely transient, try Regenerate.";
  }

  // Network / transport (post-retry surrender).
  if (
    m.includes("etimedout") ||
    m.includes("econnrefused") ||
    m.includes("econnreset") ||
    m.includes("enotfound") ||
    m.includes("getaddrinfo") ||
    m.includes("fetch failed") ||
    m.includes("socket hang up") ||
    m.includes("request timed out") ||
    m.includes("operation was aborted") ||
    m.includes("network")
  ) {
    return "Couldn't reach the image API — check the server's network or your provider's status page.";
  }

  // Empty/short response from either provider — likely transient (gemini fallback path,
  // openai b64 missing). Engine's "stopped early" wording (MAX_TOKENS, RECITATION) lands here too.
  if (
    m.includes("contained no image part") ||
    m.includes("no b64_json") ||
    m.includes("stopped early")
  ) {
    return "The image model returned no image — try Regenerate, and if it persists, simplify the prompt.";
  }

  return msg.length > 240 ? `${msg.slice(0, 237)}…` : msg;
}
const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "illustration";
const aspectRatio = (p: Illustration) => (p.aspect === "21:9" ? "21 / 9" : "16 / 9");
// The first 21:9 illustration is the wide "hero" — there is no titled cover in the current style.
const heroLabel = (p: Illustration, i: number): string | null => (i === 0 && p.aspect === "21:9" ? "Hero" : null);

function setStatus(text: string) {
  statusEl.textContent = text;
}

function readyCount(): number {
  return set ? set.illustrations.filter((p) => p.dataUri).length : 0;
}

function updateSetProgress() {
  if (!set) {
    progressEl.hidden = true;
    return;
  }
  const total = set.illustrations.length;
  const ready = readyCount();
  if (ready < total) {
    progressEl.hidden = false;
    progressEl.textContent = `${ready}/${total} rendered`;
  } else {
    progressEl.hidden = true;
  }
}

// --- the stage (current illustration) ---
function renderStage() {
  if (!set || set.illustrations.length === 0) return;
  const p = set.illustrations[current];
  const n = set.illustrations.length;

  titleEl.textContent = set.title ?? "Doodleworks MCP";
  const label = heroLabel(p, current) ?? `Illustration ${current + 1} of ${n}`;
  counterEl.textContent = `${label} — ${p.title}`;

  frameEl.style.aspectRatio = aspectRatio(p);
  const status: IllustrationStatus = p.dataUri ? "ready" : illustrationStatus.get(current) ?? "pending";
  const isRegenerating = regenerating.has(current);

  // One of: image / error / skeleton.
  if (p.dataUri) {
    imgEl.src = p.dataUri;
    imgEl.alt = `Hand-drawn illustration: ${p.title}`;
    imgEl.hidden = false;
    skeletonEl.hidden = true;
    pageErrorEl.hidden = true;
  } else if (status === "error" || status === "timeout" || status === "expired") {
    imgEl.removeAttribute("src");
    imgEl.hidden = true;
    skeletonEl.hidden = true;
    pageErrorEl.hidden = false;
    if (status === "expired") {
      pageErrorMsgEl.textContent = "This set has expired — ask again to recreate it.";
      retryBtn.hidden = true;
    } else if (status === "timeout") {
      pageErrorMsgEl.textContent = "This illustration is taking too long to render.";
      retryBtn.hidden = false;
    } else {
      const raw = illustrationErrors.get(current);
      pageErrorMsgEl.textContent = raw ? humanizeError(raw) : "This illustration failed to render.";
      retryBtn.hidden = false;
    }
  } else {
    imgEl.removeAttribute("src");
    imgEl.hidden = true;
    pageErrorEl.hidden = true;
    skeletonEl.hidden = false;
  }

  // Title caption, shown only once the image itself is on screen.
  captionEl.textContent = p.title;
  captionEl.hidden = !p.dataUri;

  regenOverlayEl.hidden = !isRegenerating;

  prevBtn.disabled = current === 0;
  nextBtn.disabled = current === n - 1;
  regenBtn.disabled = isRegenerating || !p.dataUri;
  zoomBtn.disabled = !p.dataUri;
  dlBtn.disabled = !p.dataUri;

  // If the zoom overlay is open, keep it on the current illustration.
  if (!zoomEl.hidden && p.dataUri) zoomImgEl.src = p.dataUri;
}

// --- the thumbnail strip (built once, updated in place) ---
function buildStrip() {
  stripEl.replaceChildren();
  thumbCells.clear();
  if (!set) return;
  set.illustrations.forEach((p, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "thumb";
    btn.setAttribute("aria-label", `Go to ${heroLabel(p, i) ?? p.title}`);
    btn.onclick = () => goTo(i);

    const media = document.createElement("div");
    media.className = "thumb-media";
    media.style.aspectRatio = aspectRatio(p);
    btn.appendChild(media);

    const lbl = document.createElement("div");
    lbl.className = "lbl";
    lbl.textContent = heroLabel(p, i) ?? p.title;
    btn.appendChild(lbl);

    stripEl.appendChild(btn);
    thumbCells.set(i, { btn, media });
    updateStripCell(i);
  });
  updateStripActive();
}

function updateStripCell(i: number) {
  const cell = thumbCells.get(i);
  const p = set?.illustrations[i];
  if (!cell || !p) return;
  if (p.dataUri) {
    cell.media.classList.remove("loading");
    let img = cell.media.querySelector("img");
    if (!img) {
      img = document.createElement("img");
      img.alt = "";
      cell.media.replaceChildren(img);
    }
    img.src = p.dataUri;
  } else {
    cell.media.classList.add("loading");
  }
}

function updateStripActive() {
  thumbCells.forEach((cell, i) => {
    const active = i === current;
    cell.btn.classList.toggle("active", active);
    if (active) cell.btn.setAttribute("aria-current", "true");
    else cell.btn.removeAttribute("aria-current");
  });
  const cur = thumbCells.get(current);
  cur?.btn.scrollIntoView({ inline: "nearest", block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
}

function goTo(i: number) {
  if (!set) return;
  current = Math.max(0, Math.min(set.illustrations.length - 1, i));
  renderStage();
  updateStripActive();
  const p = set.illustrations[current];
  if (!p.dataUri && !inFlight.has(current) && !regenerating.has(current)) void fetchIllustration(current);
}

// --- streaming fetch (poll until ready/terminal) ---
function markReady(index: number, dataUri: string) {
  const p = set?.illustrations[index];
  if (!p) return;
  p.dataUri = dataUri;
  illustrationStatus.set(index, "ready");
  illustrationErrors.delete(index);
  updateStripCell(index);
  if (index === current) renderStage();
  updateSetProgress();
}

function setIllustrationStatus(index: number, status: IllustrationStatus, error?: string) {
  illustrationStatus.set(index, status);
  if (error !== undefined) illustrationErrors.set(index, error);
  else if (status === "ready" || status === "pending") illustrationErrors.delete(index);
  if (index === current) renderStage();
}

async function fetchIllustration(index: number): Promise<void> {
  if (!set) return;
  const illustration = set.illustrations[index];
  if (!illustration || illustration.dataUri || regenerating.has(index)) return;
  const existing = inFlight.get(index);
  if (existing) return existing;
  const setId = set.setId;
  setIllustrationStatus(index, "pending");
  // The set can be replaced mid-poll (a new create_set result arrives). If that happens,
  // any further state writes from this closure would corrupt the new set — bail out instead.
  const isStale = () => set?.setId !== setId;
  const job = (async () => {
    try {
      for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
        if (isStale()) return;
        const result = await app.callServerTool({ name: TOOL_GET_ILLUSTRATION, arguments: { setId, index } });
        if (isStale()) return;
        const meta = (result._meta as Record<string, unknown> | undefined)?.[META_ILLUSTRATION_KEY] as
          | { dataUri?: string }
          | undefined;
        if (meta?.dataUri) {
          markReady(index, meta.dataUri);
          return;
        }
        const sc = result.structuredContent as { status?: string; error?: string } | undefined;
        if (sc?.status === "error") return setIllustrationStatus(index, "error", sc.error);
        if (sc?.status === "missing") return setIllustrationStatus(index, "expired");
        await sleep(POLL_INTERVAL_MS);
      }
      if (!isStale()) setIllustrationStatus(index, "timeout");
    } catch {
      if (!isStale()) setIllustrationStatus(index, "error");
    } finally {
      // Only clear our own slot — if the set was replaced, ontoolresult already cleared the map
      // and a new fetch may already be registered under the same index.
      if (!isStale()) inFlight.delete(index);
    }
  })();
  inFlight.set(index, job);
  return job;
}

async function fetchRemaining(): Promise<void> {
  if (!set) return;
  const queue = set.illustrations.filter((p) => !p.dataUri).map((p) => p.index);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(LAZY_CONCURRENCY, queue.length) }, async () => {
    while (cursor < queue.length) {
      await fetchIllustration(queue[cursor++]);
    }
  });
  await Promise.all(workers);
}

// --- regenerate one illustration (Regenerate button + Retry) ---
async function regenerateIllustration(index: number) {
  if (!set) return;
  const illustration = set.illustrations[index];
  const setId = set.setId;
  regenerating.add(index);
  if (!illustration.dataUri) illustrationStatus.set(index, "pending"); // a Retry from an error state → show skeleton, not the error
  illustrationErrors.delete(index); // clear any previous failure reason — we're trying again
  if (index === current) renderStage();
  setStatus("Regenerating this illustration…");
  try {
    const result = await app.callServerTool({
      name: TOOL_REGENERATE_ILLUSTRATION,
      arguments: { title: illustration.title, archetype: illustration.archetype, aspect: illustration.aspect, prompt: illustration.prompt, setId, index },
    });
    if (set?.setId !== setId) return; // set was replaced while we waited — drop the late result
    const meta = (result._meta as Record<string, unknown> | undefined)?.[META_ILLUSTRATION_KEY] as
      | { dataUri?: string }
      | undefined;
    if (meta?.dataUri && set.illustrations[index]) {
      set.illustrations[index].dataUri = meta.dataUri;
      illustrationStatus.set(index, "ready");
      illustrationErrors.delete(index);
      updateStripCell(index);
      setStatus("Updated.");
    } else {
      illustrationStatus.set(index, "error");
      illustrationErrors.set(index, "Regeneration returned no image.");
      setStatus("Regeneration returned no image.");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    illustrationStatus.set(index, "error");
    illustrationErrors.set(index, msg);
    setStatus(`Regeneration failed: ${humanizeError(msg)}`);
  } finally {
    regenerating.delete(index);
    if (index === current) renderStage();
  }
}

// --- download (host bridge, with fallbacks) ---
async function download(illustration: Illustration): Promise<void> {
  if (!illustration.dataUri) {
    await fetchIllustration(illustration.index);
    if (!illustration.dataUri) return;
  }
  // Optionally burn the title into the downloaded PNG (the displayed/cached image is untouched).
  const dataUri = burnTitleEl.checked ? await withTitle(illustration.dataUri, illustration.title) : illustration.dataUri;
  const filename = `${String(illustration.index).padStart(2, "0")}-${slug(illustration.title)}.png`;
  const caps = app.getHostCapabilities();

  // Tier 1 — preferred: ask the host to save the file (a sandboxed iframe blocks anchor downloads).
  if (caps?.downloadFile) {
    const parsed = dataUriToBlob(dataUri);
    if (parsed) {
      try {
        const { isError } = await app.downloadFile({
          contents: [{ type: "resource", resource: { uri: `file:///${filename}`, mimeType: parsed.mimeType, blob: parsed.blob } }],
        });
        if (isError) setStatus("Download was cancelled.");
      } catch (err) {
        setStatus(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      return;
    }
  }

  // Tier 2 — escape hatch: open the PNG in the external browser so the user can save it there.
  if (caps?.openLinks) {
    try {
      const { isError } = await app.openLink({ url: dataUri });
      setStatus(isError ? "Your host blocked opening the image." : "Opened the image in your browser — save it from there.");
    } catch (err) {
      setStatus(`Couldn't open the image: ${err instanceof Error ? err.message : String(err)}`);
    }
    return;
  }

  // Tier 3 — fallback for plain-browser hosts that allow anchor downloads.
  const a = document.createElement("a");
  a.href = dataUri;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// --- host theme: match the host's colours and fonts when it provides them ---
function applyHostTheme(ctx: McpUiHostContext | undefined) {
  if (!ctx) return;
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) {
    applyHostStyleVariables(ctx.styles.variables);
    document.documentElement.classList.add("themed"); // disables the prefers-color-scheme fallback
  }
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
}

// --- zoom (read the small annotations) ---
let zoomReturnFocus: HTMLElement | null = null;
function openZoom() {
  if (!set) return;
  const p = set.illustrations[current];
  if (!p.dataUri) return;
  zoomReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  zoomImgEl.src = p.dataUri;
  zoomImgEl.alt = `Hand-drawn illustration: ${p.title}`;
  zoomEl.hidden = false;
  zoomCloseBtn.focus();
}
function closeZoom() {
  if (zoomEl.hidden) return;
  zoomEl.hidden = true;
  zoomImgEl.removeAttribute("src");
  (zoomReturnFocus ?? zoomBtn).focus();
}

// --- compose the title onto a PNG (client-side, downloads only — the displayed/cached image
// stays clean). Drawing a data-URI onto a canvas does not taint it, so toDataURL works in the iframe.
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}
async function withTitle(dataUri: string, title: string): Promise<string> {
  try {
    const img = await loadImage(dataUri);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return dataUri;

    // The title goes in a dedicated caption band BELOW the artwork — never overlapping it —
    // in the same sans-serif family the in-viewer caption uses, so a saved PNG reads
    // consistently and the illustration itself is never covered.
    const fontSize = Math.max(16, Math.round(h * 0.04));
    const bandH = Math.round(fontSize * 2.4);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h + bandH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUri;

    // Pure-white canvas (matches the house background), artwork on top, title in the band below.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h + bandH);
    ctx.drawImage(img, 0, 0);
    // Hairline rule separating the artwork from the caption band.
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = Math.max(1, Math.round(h * 0.0025));
    ctx.beginPath();
    ctx.moveTo(0, h + 0.5);
    ctx.lineTo(w, h + 0.5);
    ctx.stroke();

    ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#1a1a1a";
    const maxText = w * 0.9;
    let text = title;
    if (ctx.measureText(text).width > maxText) {
      while (text.length > 1 && ctx.measureText(`${text}…`).width > maxText) text = text.slice(0, -1);
      text = `${text.replace(/\s+$/, "")}…`;
    }
    ctx.fillText(text, w / 2, h + bandH / 2);
    return canvas.toDataURL("image/png");
  } catch {
    return dataUri; // never block a download on the title caption
  }
}

// --- app bridge ---
const app = new App({ name: "Doodleworks MCP", version: "1.0.0" });

// Receive the create_illustrations result. Set before connect() so the initial result isn't missed.
app.ontoolresult = (result) => {
  const payload = (result._meta as Record<string, unknown> | undefined)?.[META_SET_KEY] as IllustrationSet | undefined;
  if (!payload?.illustrations?.length || !payload.setId) {
    // A tool result reached the viewer but carried no usable `doodleworks/set`. The common cause is a
    // server/viewer version skew: the host serves a stale `dist/mcp-app.html` (Claude Desktop runs the
    // server via `tsx` and never rebuilds the viewer) while the server emits a newer `_meta` shape — so
    // this silently returned and the UI hung on "Waiting…". Surface it loudly instead.
    console.warn(
      "[doodleworks] ontoolresult: no usable `_meta['doodleworks/set']` in the tool result — " +
        "likely a stale viewer bundle (run `pnpm run build`, then restart the host). Raw _meta keys:",
      result._meta ? Object.keys(result._meta as Record<string, unknown>) : result,
    );
    emptyEl.textContent =
      "Couldn't load this set — the viewer and server are out of sync. Rebuild the app (pnpm run build) and restart the host.";
    emptyEl.hidden = false;
    frameEl.hidden = true;
    return;
  }
  set = payload;
  current = 0;
  illustrationStatus.clear();
  illustrationErrors.clear();
  regenerating.clear();
  inFlight.clear();
  payload.illustrations.forEach((_, i) => illustrationStatus.set(i, "pending"));
  emptyEl.hidden = true;
  frameEl.hidden = false;
  setStatus("");
  buildStrip();
  renderStage();
  updateSetProgress();
  // Illustrations render server-side in the background; stream them in (index order, hero first).
  void fetchRemaining();
};

prevBtn.onclick = () => goTo(current - 1);
nextBtn.onclick = () => goTo(current + 1);
regenBtn.onclick = () => {
  if (set) void regenerateIllustration(current);
};
retryBtn.onclick = () => {
  if (set) void regenerateIllustration(current);
};
dlBtn.onclick = () => {
  if (set && set.illustrations[current].dataUri) void download(set.illustrations[current]);
};
dlAllBtn.onclick = async () => {
  if (!set) return;
  dlAllBtn.disabled = true;
  try {
    if (readyCount() < set.illustrations.length) setStatus("Waiting for all illustrations to render…");
    await fetchRemaining();
    const ready = set.illustrations.filter((p) => p.dataUri);
    for (let i = 0; i < ready.length; i++) {
      setStatus(`Downloading ${i + 1} of ${ready.length}…`);
      await download(ready[i]);
    }
    setStatus(ready.length ? "" : "No illustrations were ready to download.");
  } finally {
    dlAllBtn.disabled = false;
  }
};

zoomBtn.onclick = openZoom;
imgEl.onclick = openZoom;
zoomCloseBtn.onclick = closeZoom;
zoomEl.onclick = (e) => {
  if (e.target === zoomEl) closeZoom(); // click the backdrop (not the image) to close
};

// Keyboard navigation across the set (slideshow expectation); Escape closes the zoom overlay.
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !zoomEl.hidden) {
    e.preventDefault();
    closeZoom();
    return;
  }
  if (!set) return;
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
  switch (e.key) {
    case "ArrowLeft": if (current > 0) { e.preventDefault(); goTo(current - 1); } break;
    case "ArrowRight": if (current < set.illustrations.length - 1) { e.preventDefault(); goTo(current + 1); } break;
    case "Home": e.preventDefault(); goTo(0); break;
    case "End": e.preventDefault(); goTo(set.illustrations.length - 1); break;
  }
});

// Match the host's theme (Claude Desktop etc.) when it provides one.
app.onhostcontextchanged = (ctx) => applyHostTheme(ctx);
void app.connect().then(() => applyHostTheme(app.getHostContext()));
