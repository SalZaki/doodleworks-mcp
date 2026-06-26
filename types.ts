/**
 * types.ts — wire-format shared between server.ts and the in-iframe View.
 * Imported by both the Node build and the browser bundle, so it must stay
 * free of runtime dependencies.
 */

/**
 * `_meta` keys carrying View-only payloads (never model-visible image bytes), shared by server.ts
 * (writes `_meta[META_SET_KEY]`/`_meta[META_ILLUSTRATION_KEY]`) and the viewer (reads them by the
 * same constant). Hoisted so the key strings can't drift between the two halves. On a mismatch the
 * viewer silently rejects the payload and hangs on "Waiting for the illustrations…".
 */
export const META_SET_KEY = "doodleworks/set" as const;
export const META_ILLUSTRATION_KEY = "doodleworks/illustration" as const;

/**
 * Wire-contract version for the `_meta` payloads above. **Bump this whenever the shape of the
 * `META_SET_KEY` / `META_ILLUSTRATION_KEY` payloads changes** in a way the viewer must understand.
 *
 * The server stamps it on every `create_illustrations` result (under `META_CONTRACT_KEY`); the
 * viewer compares it to the value baked into its bundle at build time. A mismatch means the host is
 * serving a stale `dist/mcp-app.html` (built against an older contract), so the viewer says exactly
 * that — "run `pnpm run build`" — instead of failing with a generic error or hanging.
 */
export const VIEWER_CONTRACT_VERSION = 1 as const;
export const META_CONTRACT_KEY = "doodleworks/contract" as const;

/**
 * MCP tool names, shared by server.ts (registers them) and the viewer (invokes
 * get_illustration / regenerate_illustration via callServerTool). Hoisted so the name the
 * viewer calls can't drift from the name the server registers. On a mismatch the viewer's calls
 * fail with "tool not found" and illustrations never stream in.
 */
export const TOOL_CREATE_ILLUSTRATIONS = "create_illustrations" as const;
export const TOOL_GET_ILLUSTRATION = "get_illustration" as const;
export const TOOL_REGENERATE_ILLUSTRATION = "regenerate_illustration" as const;

export type Aspect = "21:9" | "16:9";

export interface Illustration {
  index: number;
  title: string;
  archetype?: string;
  aspect: Aspect;
  prompt: string;
  /** Absent in the create_illustrations _meta payload; the View fetches it via get_illustration. */
  dataUri?: string;
}

export interface IllustrationSet {
  /** Server-minted handle the View passes to get_illustration / regenerate_illustration. */
  setId: string;
  title: string | null;
  illustrations: Illustration[];
}
