#!/usr/bin/env node
/**
 * main.ts — entry point. No flag → stdio transport, for use inside an MCP host
 * (Claude Desktop, VS Code, etc.) via `npx doodleworks-mcp`. `--http` starts a
 * local Streamable HTTP server for testing with the ext-apps basic-host
 * (`--stdio` is still accepted). Adapted from the MCP Apps quickstart.
 */

import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import type { Request, Response } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VIEWER_BUNDLE } from "./paths.js";
import { createServer } from "./server.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

/**
 * Warn (loudly, to stderr — the channel MCP hosts log) when the built viewer is missing or older
 * than its sources. The dev viewer flow (the local `--http` dev server via `pnpm start`) runs the
 * server live but NEVER rebuilds the Vite single-file viewer in `dist/`. So editing the viewer and
 * restarting the dev server silently serves a stale bundle: if the server's `_meta` shape has moved on,
 * the viewer rejects the payload and the UI hangs forever on "Waiting for the illustrations…".
 * Surfacing it here puts the fix ("run `pnpm run build`") in the exact log a confused user checks.
 * Best-effort: any stat failure is swallowed so this never blocks startup.
 */
async function warnIfViewerStale(): Promise<void> {
  try {
    const bundle = VIEWER_BUNDLE;
    const bundleStat = await fs.stat(bundle).catch(() => undefined);
    if (!bundleStat) {
      console.error(
        "[doodleworks-mcp] viewer bundle dist/mcp-app.html is missing — run `pnpm run build`, then restart the host. The viewer will not open until it is built.",
      );
      return;
    }
    // The viewer is built from mcp-app.html + everything under src/ + the shared types.
    const srcDir = path.join(MODULE_DIR, "src");
    const srcEntries = await fs.readdir(srcDir).catch(() => [] as string[]);
    const sources = [
      path.join(MODULE_DIR, "mcp-app.html"),
      path.join(MODULE_DIR, "types.ts"),
      ...srcEntries.map((f) => path.join(srcDir, f)),
    ];
    let newestSrc = 0;
    for (const file of sources) {
      const s = await fs.stat(file).catch(() => undefined);
      if (s && s.mtimeMs > newestSrc) newestSrc = s.mtimeMs;
    }
    if (newestSrc > bundleStat.mtimeMs) {
      console.error(
        "[doodleworks-mcp] viewer bundle dist/mcp-app.html is OLDER than its sources — the host is serving a stale viewer. " +
          "Run `pnpm run build` and restart the host. (Symptom of a stale bundle: the viewer hangs on \"Waiting for the illustrations…\".)",
      );
    }
  } catch {
    // never let the staleness check break startup
  }
}

export async function startStreamableHTTPServer(factory: () => McpServer): Promise<void> {
  const rawPort = process.env.PORT ?? "3001";
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${JSON.stringify(rawPort)} (expected an integer 1-65535)`);
  }
  // Loopback-only + a localhost CORS allowlist: a webpage the user visits cannot
  // hit this server cross-origin and drain the user's image-API key.
  const app = createMcpExpressApp({ host: "127.0.0.1" });
  app.use(
    cors({
      origin: [/^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/],
    }),
  );

  app.all("/mcp", async (req: Request, res: Response) => {
    const server = factory();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // Bind explicitly to loopback. `createMcpExpressApp({ host: "127.0.0.1" })` only installs
  // a Host-header validator — it does NOT bind the socket. Without the host arg below,
  // express.listen defaults to 0.0.0.0 and the server is reachable from the LAN.
  const httpServer = app.listen(port, "127.0.0.1", () => {
    console.log(`Doodleworks MCP server on http://localhost:${port}/mcp`);
  });
  // listen's callback fires on the 'listening' event and never receives an error argument.
  // Startup failures (e.g. EADDRINUSE when the port is already taken) arrive as an 'error'
  // event instead — catch them here, otherwise Node throws the error as an uncaught exception.
  httpServer.on("error", (err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });

  const shutdown = () => httpServer.close(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

export async function startStdioServer(factory: () => McpServer): Promise<void> {
  await factory().connect(new StdioServerTransport());
}

async function main() {
  if (process.argv.includes("--http")) {
    await warnIfViewerStale();
    await startStreamableHTTPServer(createServer);
  } else {
    await startStdioServer(createServer);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
