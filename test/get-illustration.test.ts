import { test } from "node:test";
import assert from "node:assert/strict";
import { startTestClient, fakeImage, waitForIllustration } from "./mcp-harness.js";

test("get_illustration streams an illustration from pending to ready", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const { client, close } = await startTestClient(async () => {
    await gate;
    return fakeImage("data:image/png;base64,UkVBRFk=");
  });
  try {
    const created = await client.callTool({
      name: "create_illustrations",
      arguments: { illustrations: [{ title: "A", prompt: "p" }] },
    });
    const setId = (created._meta as Record<string, any>)["doodleworks/set"].setId;

    // The background render is gated, so the first poll sees it still rendering.
    const pending = await client.callTool({ name: "get_illustration", arguments: { setId, index: 0 } });
    assert.equal((pending.structuredContent as any).status, "pending");
    assert.equal((pending._meta as any)["doodleworks/illustration"], undefined, "no image while pending");

    release();
    const ready = await waitForIllustration(client, setId, 0);
    assert.equal(ready.structuredContent?.status, "ready");
    assert.match(ready._meta?.["doodleworks/illustration"].dataUri, /UkVBRFk=/);
  } finally {
    await close();
  }
});

test("get_illustration reports the real error when a render fails", async () => {
  const { client, close } = await startTestClient(async () => {
    throw new Error("Rate limit reached for gpt-image-1");
  });
  try {
    const created = await client.callTool({
      name: "create_illustrations",
      arguments: { illustrations: [{ title: "A", prompt: "p" }] },
    });
    const setId = (created._meta as Record<string, any>)["doodleworks/set"].setId;

    const result = await waitForIllustration(client, setId, 0);
    assert.equal(result.structuredContent?.status, "error");
    // The raw provider message must reach the viewer so it can humanize it.
    assert.match(String(result.structuredContent?.error), /Rate limit reached/);
  } finally {
    await close();
  }
});

test("get_illustration returns 'missing' for an unknown set", async () => {
  const { client, close } = await startTestClient(async () => fakeImage());
  try {
    const result = await client.callTool({
      name: "get_illustration",
      arguments: { setId: "does-not-exist", index: 0 },
    });
    assert.equal((result.structuredContent as any).status, "missing");
  } finally {
    await close();
  }
});
