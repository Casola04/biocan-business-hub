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

// 3. Vercel Node function entry: re-export TanStack Start fetch handler.
//    Vercel's Node runtime supports web-standard `default export { fetch }`.
writeFileSync(
  join(fnDir, "index.mjs"),
  `import handler from "./server.js";\nexport default handler;\n`,
);

// 4. Function config (Node 20, web-standard handler)
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
