import { test } from "node:test";
import assert from "node:assert/strict";
import { withTimeout } from "../engine.js";

// withTimeout bounds a single provider attempt: it resolves if fn settles first, otherwise it
// aborts the signal it handed fn and rejects with a retryable error so the render slot is freed.

test("withTimeout resolves with fn's value when fn settles before the deadline", async () => {
  const result = await withTimeout(1000, async () => "ok");
  assert.equal(result, "ok");
});

test("withTimeout rejects when fn does not settle before the deadline", async () => {
  await assert.rejects(
    withTimeout(10, () => new Promise<never>(() => {})),
    /timed out/i,
  );
});

test("withTimeout aborts the signal it passes to fn when the deadline passes", async () => {
  let captured: AbortSignal | undefined;
  await assert.rejects(
    withTimeout(10, (signal) => {
      captured = signal;
      return new Promise<never>(() => {});
    }),
    /timed out/i,
  );
  assert.ok(captured, "fn should receive an AbortSignal");
  assert.equal(captured!.aborted, true, "signal must be aborted once the deadline passes");
});

test("withTimeout does not abort the signal when fn settles in time", async () => {
  let captured: AbortSignal | undefined;
  await withTimeout(1000, async (signal) => {
    captured = signal;
    return 1;
  });
  assert.equal(captured!.aborted, false, "signal must not be aborted on the happy path");
});

test("the timeout error is non-retryable (status 408) so a wedged request fails fast", async () => {
  const err = await withTimeout(10, () => new Promise<never>(() => {})).catch((e) => e);
  assert.ok(err instanceof Error);
  assert.match((err as Error).message, /timed out/i);
  assert.equal((err as { status?: number }).status, 408, "timeout pins 408 so isRetryable() returns false");
});

test("withTimeout passes a non-timeout rejection through untouched (keeps its retryability)", async () => {
  const original = Object.assign(new Error("upstream 503"), { status: 503 });
  const err = await withTimeout(1000, () => Promise.reject(original)).catch((e) => e);
  assert.equal(err, original, "a real provider error must propagate unchanged");
});
