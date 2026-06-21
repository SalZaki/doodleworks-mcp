import { test } from "node:test";
import assert from "node:assert/strict";
import { startTestClient, fakeImage } from "./mcp-harness.js";

// The server keeps the last 8 sets (MAX_CACHED_SETS). The 9th create must evict the oldest,
// so its setId then 404s as "missing" — the viewer's "set expired" path.
test("creating more than 8 sets evicts the oldest", async () => {
  const { client, close } = await startTestClient(async () => fakeImage());
  try {
    const setIds: string[] = [];
    for (let i = 0; i < 9; i++) {
      const created = await client.callTool({
        name: "create_illustrations",
        arguments: { title: `set ${i}`, illustrations: [{ title: "A", prompt: "p" }] },
      });
      setIds.push((created._meta as Record<string, any>)["doodleworks/set"].setId);
    }

    const oldest = await client.callTool({ name: "get_illustration", arguments: { setId: setIds[0], index: 0 } });
    assert.equal((oldest.structuredContent as any).status, "missing", "oldest set should be evicted");

    const newest = await client.callTool({ name: "get_illustration", arguments: { setId: setIds[8], index: 0 } });
    assert.notEqual((newest.structuredContent as any).status, "missing", "newest set should still be cached");
  } finally {
    await close();
  }
});
