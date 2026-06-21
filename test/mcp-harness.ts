/**
 * Test harness: drives the real Doodleworks MCP server over an in-memory transport with an
 * injected fake renderPage, so tests exercise the actual tool wiring without ever calling the
 * paid image API.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../server.js";
import type { PageSpec, RenderOptions, RenderedImage } from "../engine.js";

export type RenderPageFn = (page: PageSpec, opts?: RenderOptions) => Promise<RenderedImage>;

export interface TestClient {
  client: Client;
  close: () => Promise<void>;
}

/** Connect a Client to a fresh server instance via a linked in-memory transport pair. */
export async function startTestClient(renderPage: RenderPageFn): Promise<TestClient> {
  const server = createServer({ renderPage });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "doodleworks-test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

/** A deterministic rendered image — no bytes that look like a real PNG, just a stable marker. */
export function fakeImage(dataUri = "data:image/png;base64,ZmFrZQ=="): RenderedImage {
  return { dataUri, mimeType: "image/png", width: 16, height: 9 };
}

interface IllustrationResult {
  structuredContent?: { status?: string; error?: string; [k: string]: unknown };
  _meta?: Record<string, any>;
  [k: string]: unknown;
}

/**
 * Poll get_illustration the way the viewer does, until it reaches a terminal status
 * (ready / error / missing) or the attempt budget runs out.
 */
export async function waitForIllustration(
  client: Client,
  setId: string,
  index: number,
  attempts = 50,
): Promise<IllustrationResult> {
  for (let i = 0; i < attempts; i++) {
    const result = (await client.callTool({
      name: "get_illustration",
      arguments: { setId, index },
    })) as IllustrationResult;
    const status = result.structuredContent?.status;
    if (status && status !== "pending") return result;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`illustration ${setId}/${index} never left pending after ${attempts} polls`);
}
