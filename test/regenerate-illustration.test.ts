import { test } from "node:test";
import assert from "node:assert/strict";
import type { PageSpec, RenderOptions } from "../engine.js";
import { startTestClient, fakeImage, waitForIllustration } from "./mcp-harness.js";

test("regenerate_illustration replaces the cached image in place", async () => {
  let n = 0;
  const { client, close } = await startTestClient(async () => fakeImage(`data:image/png;base64,IMG${n++}`));
  try {
    const created = await client.callTool({
      name: "create_illustrations",
      arguments: { illustrations: [{ title: "A", prompt: "p" }] },
    });
    const setId = (created._meta as Record<string, any>)["doodleworks/set"].setId;
    const first = await waitForIllustration(client, setId, 0);
    assert.match(first._meta?.["doodleworks/illustration"].dataUri, /IMG0/);

    await client.callTool({
      name: "regenerate_illustration",
      arguments: { prompt: "p (take 2)", setId, index: 0 },
    });

    // A fresh get_illustration must now serve the regenerated image, not the original.
    const after = await client.callTool({ name: "get_illustration", arguments: { setId, index: 0 } });
    assert.match((after._meta as any)["doodleworks/illustration"].dataUri, /IMG1/);
  } finally {
    await close();
  }
});

test("regenerate replays the set's resolution and styleReference when the call omits them", async () => {
  const calls: Array<{ page: PageSpec; opts?: RenderOptions }> = [];
  const { client, close } = await startTestClient(async (page, opts) => {
    calls.push({ page, opts });
    return fakeImage();
  });
  try {
    const created = await client.callTool({
      name: "create_illustrations",
      arguments: {
        resolution: "2k",
        styleReference: "wiki-00-ref",
        illustrations: [{ title: "A", prompt: "p" }],
      },
    });
    const setId = (created._meta as Record<string, any>)["doodleworks/set"].setId;
    await waitForIllustration(client, setId, 0);

    // The viewer's Regenerate button sends only prompt + setId + index — never the set's
    // resolution/styleReference. The server must recover them from the cached set.
    await client.callTool({
      name: "regenerate_illustration",
      arguments: { prompt: "p", setId, index: 0 },
    });

    const regen = calls.at(-1)!;
    assert.equal(regen.opts?.resolution, "2k", "regen should replay the set resolution");
    assert.equal(regen.opts?.styleReference, "wiki-00-ref", "regen should replay the set styleReference");
  } finally {
    await close();
  }
});
