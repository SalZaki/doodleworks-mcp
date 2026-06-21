/**
 * types.ts — wire-format shared between server.ts and the in-iframe View.
 * Imported by both the Node build and the browser bundle, so it must stay
 * free of runtime dependencies.
 */

/**
 * `_meta` keys carrying View-only payloads (never model-visible image bytes). These are the single
 * source of truth shared by server.ts (which emits them) and the viewer (which reads them): the
 * server writes `_meta[META_SET_KEY]`/`_meta[META_ILLUSTRATION_KEY]` and the View looks them up by
 * the same constant. Hoisted here so the key strings can't drift between the two halves — a mismatch
 * makes the viewer silently reject the payload and hang on "Waiting for the illustrations…".
 */
export const META_SET_KEY = "doodleworks/set" as const;
export const META_ILLUSTRATION_KEY = "doodleworks/illustration" as const;

/**
 * MCP tool names. The single source of truth shared by server.ts (which registers them) and the
 * viewer (which invokes get_illustration / regenerate_illustration via callServerTool). Hoisted so
 * the name the viewer calls can't drift from the name the server registers — a mismatch makes the
 * viewer's calls fail with "tool not found" and illustrations never stream in.
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
