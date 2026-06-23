import { test } from "node:test";
import assert from "node:assert/strict";
import { startTestClient, fakeImage } from "./mcp-harness.js";
import { META_CONTRACT_KEY, VIEWER_CONTRACT_VERSION } from "../types.js";

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

test("create_illustrations stamps the viewer contract version so the viewer can detect a stale bundle", async () => {
  const { client, close } = await startTestClient(async () => fakeImage());
  try {
    const result = await client.callTool({
      name: "create_illustrations",
      arguments: { illustrations: [{ title: "A", prompt: "p" }] },
    });
    const contract = (result._meta as Record<string, any> | undefined)?.[META_CONTRACT_KEY];
    assert.equal(
      contract?.version,
      VIEWER_CONTRACT_VERSION,
      "expected the server to stamp the current contract version in _meta",
    );
  } finally {
    await close();
  }
});
