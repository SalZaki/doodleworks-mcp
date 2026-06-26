import { test } from "node:test";
import assert from "node:assert/strict";
import { startTestClient, fakeImage, waitForIllustration } from "./mcp-harness.js";

// When a regenerate names a set to update (setId given) but the target illustration doesn't exist
// (unknown set, or an out-of-range index), it must fail fast — without spending a paid render on an
// image get_illustration could never serve, since nothing would be cached.
test("regenerate with a setId but an out-of-range index returns missing and does not render", async () => {
  let renders = 0;
  const { client, close } = await startTestClient(async () => {
    renders++;
    return fakeImage();
  });
  try {
    const created = await client.callTool({
      name: "create_illustrations",
      arguments: { illustrations: [{ title: "A", prompt: "p" }] },
    });
    const setId = (created._meta as Record<string, any>)["doodleworks/set"].setId;
    await waitForIllustration(client, setId, 0);
    const before = renders;

    const result = await client.callTool({
      name: "regenerate_illustration",
      arguments: { prompt: "x", setId, index: 5 }, // out of range
    });
    assert.equal((result.structuredContent as any).ok, false);
    assert.equal((result.structuredContent as any).status, "missing");
    assert.equal(renders, before, "must not spend a render on an unknown set/index");
  } finally {
    await close();
  }
});

test("regenerate with an unknown setId returns missing and does not render", async () => {
  let renders = 0;
  const { client, close } = await startTestClient(async () => {
    renders++;
    return fakeImage();
  });
  try {
    const result = await client.callTool({
      name: "regenerate_illustration",
      arguments: { prompt: "x", setId: "does-not-exist", index: 0 },
    });
    assert.equal((result.structuredContent as any).status, "missing");
    assert.equal(renders, 0, "must not spend a render on an unknown set");
  } finally {
    await close();
  }
});

// The no-setId path is an intentional "render fresh, don't persist" call (the viewer never uses it,
// but it must keep working): it should still return an image and not be rejected by the guard.
test("regenerate without a setId still renders a view-only image", async () => {
  const { client, close } = await startTestClient(async () => fakeImage("data:image/png;base64,Vk9M"));
  try {
    const result = await client.callTool({
      name: "regenerate_illustration",
      arguments: { prompt: "fresh" },
    });
    assert.equal((result.structuredContent as any).ok, true);
    assert.match((result._meta as any)["doodleworks/illustration"].dataUri, /Vk9M/);
  } finally {
    await close();
  }
});
