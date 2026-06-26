import { test } from "node:test";
import assert from "node:assert/strict";
import { startTestClient, fakeImage } from "./mcp-harness.js";

// An empty-string set title should be treated as "no title": normalized to null everywhere, so the
// stored payload, the model-visible summary, and structuredContent all agree instead of one storing
// "" while the others omit it.
test("an empty-string set title is normalized to null and omitted from the summary", async () => {
  const { client, close } = await startTestClient(async () => fakeImage());
  try {
    const result = await client.callTool({
      name: "create_illustrations",
      arguments: { title: "", illustrations: [{ title: "A", prompt: "p" }] },
    });
    const text = (result.content as Array<{ text: string }>)[0].text;
    assert.ok(!text.includes('("")'), "summary must not show an empty quoted title");
    const setMeta = (result._meta as Record<string, any>)["doodleworks/set"];
    assert.equal(setMeta.title, null, "an empty title must be stored as null");
    assert.notEqual((result.structuredContent as any).title, "", "structuredContent.title must not be an empty string");
  } finally {
    await close();
  }
});

test("a whitespace-only set title is normalized to null", async () => {
  const { client, close } = await startTestClient(async () => fakeImage());
  try {
    const result = await client.callTool({
      name: "create_illustrations",
      arguments: { title: "   ", illustrations: [{ title: "A", prompt: "p" }] },
    });
    const setMeta = (result._meta as Record<string, any>)["doodleworks/set"];
    assert.equal(setMeta.title, null, "a whitespace-only title must be stored as null");
  } finally {
    await close();
  }
});
