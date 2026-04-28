#!/usr/bin/env node
// Assembles dist/client + dist/server into Vercel Build Output API format (.vercel/output/)
// Docs: https://vercel.com/docs/build-output-api/v3
import { mkdirSync, cpSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const out = join(root, ".vercel", "output");
const staticDir = join(out, "static");
const fnDir = join(out, "functions", "index.func");

rmSync(join(root, ".vercel", "output"), { recursive: true, force: true });
mkdirSync(staticDir, { recursive: true });
mkdirSync(fnDir, { recursive: true });

// 1. Copy static client assets
const clientDir = join(root, "dist", "client");
if (existsSync(clientDir)) cpSync(clientDir, staticDir, { recursive: true });

// 2. Copy SSR server bundle into the function directory
const serverDir = join(root, "dist", "server");
cpSync(serverDir, fnDir, { recursive: true });

// 3. Vercel Node launcher entry. Vercel's Node runtime invokes this as a
//    classic (req, res) handler. TanStack Start exports a Web-standard
//    { fetch(Request) -> Response } handler, so we adapt between the two.
writeFileSync(
  join(fnDir, "index.mjs"),
  `import { Readable } from "node:stream";
import server from "./server.js";

export default async function handler(req, res) {
  try {
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
    const url = new URL(req.url || "/", protocol + "://" + host);

    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) for (const vv of v) headers.append(k, vv);
      else if (v != null) headers.set(k, String(v));
    }

    const method = (req.method || "GET").toUpperCase();
    const hasBody = method !== "GET" && method !== "HEAD";

    const request = new Request(url, {
      method,
      headers,
      body: hasBody ? Readable.toWeb(req) : undefined,
      // @ts-expect-error - duplex required when streaming a body
      duplex: hasBody ? "half" : undefined,
    });

    const response = await server.fetch(request);

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      // Skip headers that Node sets itself or that conflict with streaming
      if (key.toLowerCase() === "content-encoding") return;
      res.setHeader(key, value);
    });

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body);
      nodeStream.pipe(res);
      nodeStream.on("error", (err) => {
        console.error("[ssr] response stream error:", err);
        try { res.end(); } catch {}
      });
    } else {
      res.end();
    }
  } catch (err) {
    console.error("[ssr] handler crashed:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain");
    }
    res.end("Internal Server Error");
  }
}
`,
);

// 4. Function config (Node 20)
writeFileSync(
  join(fnDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs20.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      supportsResponseStreaming: true,
    },
    null,
    2,
  ),
);

// 5. Top-level config: serve static assets when present, else SSR.
writeFileSync(
  join(out, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: "filesystem" },
        { src: "/(.*)", dest: "/index" },
      ],
    },
    null,
    2,
  ),
);

console.log("✓ Vercel Build Output assembled at .vercel/output/");
