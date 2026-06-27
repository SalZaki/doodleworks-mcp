// Packs the real tarball, installs it into a temp dir, runs the published bin
// over stdio, and asserts it answers an MCP initialize. Proves the packaged
// layout (compiled JS + co-located viewer + references) actually runs.
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const repo = process.cwd();
const tar = execFileSync("npm", ["pack", "--silent"], { cwd: repo }).toString().trim().split("\n").pop();
const dir = mkdtempSync(path.join(tmpdir(), "dw-smoke-"));
writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "smoke", private: true }));
execFileSync("npm", ["install", "--no-save", path.join(repo, tar)], { cwd: dir, stdio: "inherit" });

const bin = path.join(dir, "node_modules", ".bin", "doodleworks-mcp");
const child = spawn(bin, [], { cwd: dir });
let out = "";
let passed = false;
child.stdout.on("data", (d) => (out += d));
child.stderr.on("data", (d) => process.stderr.write(d));
child.stdin.write(
  JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "0" } } }) + "\n",
);

const timer = setTimeout(() => { child.kill(); fail("no response within 10s"); }, 10_000);
function fail(m) { console.error(`SMOKE FAIL: ${m}`); process.exit(1); }
child.stdout.on("data", () => {
  if (out.includes('"result"') && out.includes("serverInfo")) {
    passed = true;
    clearTimeout(timer); child.kill();
    console.log("SMOKE OK: packaged npx server answered initialize");
    process.exit(0);
  }
});
child.on("exit", (code) => { if (passed) return; clearTimeout(timer); fail(`bin exited early (code ${code})`); });
