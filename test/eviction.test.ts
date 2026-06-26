import { test } from "node:test";
import assert from "node:assert/strict";
import { startTestClient, fakeImage } from "./mcp-harness.js";

// When a set is evicted from the LRU cache while its illustrations are still rendering in the
// background, the workers must stop — they should not keep spending the image API on a set whose
// results the viewer can never fetch again.
test("evicting a set mid-render stops its still-queued background renders", async () => {
  let started = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const { client, close } = await startTestClient(async (page) => {
    if (page.prompt.startsWith("BLOCK")) {
      started++;
      await gate; // hold the in-flight workers so the rest of the set stays queued
    }
    return fakeImage();
  });
  try {
    // A full set of 8; render concurrency is 3, so 3 start and the other 5 wait in the worker queue.
    const created = await client.callTool({
      name: "create_illustrations",
      arguments: { illustrations: Array.from({ length: 8 }, (_, i) => ({ title: `B${i}`, prompt: `BLOCK ${i}` })) },
    });
    const setId = (created._meta as Record<string, any>)["doodleworks/set"].setId;

    // Push 8 more single-illustration sets (fast renders) to evict the first (MAX_CACHED_SETS = 8).
    for (let i = 0; i < 8; i++) {
      await client.callTool({
        name: "create_illustrations",
        arguments: { illustrations: [{ title: "x", prompt: "fast" }] },
      });
    }
    const gone = await client.callTool({ name: "get_illustration", arguments: { setId, index: 0 } });
    assert.equal((gone.structuredContent as any).status, "missing", "the first set must have been evicted");

    // Release the in-flight renders; the queued ones must bail because their set is gone.
    release();
    await new Promise((r) => setTimeout(r, 50));
    assert.ok(
      started < 8,
      `evicted set kept rendering: ${started}/8 illustrations ran (only the in-flight few should have)`,
    );
  } finally {
    release();
    await close();
  }
});
