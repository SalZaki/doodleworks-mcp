import { test } from "node:test";
import assert from "node:assert/strict";
import { startTestClient, fakeImage } from "./mcp-harness.js";

// All tests inject a fake renderPage, so they never call the paid image API.

test("create_illustrations returns a setId and carries no image bytes in content", async () => {
  const { client, close } = await startTestClient(async () => fakeImage());
  try {
    const result = await client.callTool({
      name: "create_illustrations",
      arguments: { title: "Sorting", illustrations: [{ title: "A", prompt: "p" }] },
    });

    const meta = (result._meta as Record<string, any> | undefined)?.["doodleworks/set"];
    assert.ok(meta?.setId, "expected a setId in _meta['doodleworks/set']");
    assert.equal(meta.illustrations.length, 1);

    // Context-safety: the model-visible content must never contain rendered image bytes.
    const blob = JSON.stringify(result.content) + JSON.stringify(result.structuredContent);
    assert.ok(!blob.includes("data:image"), "content/structuredContent must not carry image bytes");
  } finally {
    await close();
  }
});
