#!/usr/bin/env node
import http from 'http';
import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const PORT = Number(process.env.CADENCE_PREVIEW_PORT || 43127);

async function ensureBuild() {
  if (existsSync(join(root, 'dist', 'webview.js')) && existsSync(join(root, 'dist', 'webview.css'))) return;
  await new Promise((resolve, reject) => {
    const child = spawn('node', ['esbuild.mjs'], { cwd: root, stdio: 'inherit' });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`build failed: ${code}`))));
  });
}

async function loadAnalyzer() {
  // Use compiled-free ts via dynamic import of source through vitest-less path:
  // run a tiny CJS bridge built into dist for preview RPC.
  const require = createRequire(import.meta.url);
  // Build a node-friendly analyzer bundle on the fly with esbuild if needed.
  const esbuild = require('esbuild');
  const outfile = join(root, 'dist', 'preview-api.cjs');
  await esbuild.build({
    entryPoints: [join(root, 'scripts/preview-api.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile,
    sourcemap: false,
  });
  return require(outfile);
}

function htmlPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cadence Preview</title>
  <link rel="stylesheet" href="/webview.css" />
</head>
<body>
  <div id="app"></div>
  <script>
    window.__cadencePreviewRpc = async (method, params = {}) => {
      const res = await fetch('/rpc', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method, params }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'RPC failed');
      return json.result;
    };
  </script>
  <script src="/webview.js"></script>
</body>
</html>`;
}

await ensureBuild();
const api = await loadAnalyzer();

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url?.startsWith('/index'))) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(htmlPage());
      return;
    }
    if (req.method === 'GET' && req.url === '/webview.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end(readFileSync(join(root, 'dist', 'webview.js')));
      return;
    }
    if (req.method === 'GET' && req.url === '/webview.css') {
      res.writeHead(200, { 'content-type': 'text/css; charset=utf-8' });
      res.end(readFileSync(join(root, 'dist', 'webview.css')));
      return;
    }
    if (req.method === 'POST' && req.url === '/rpc') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const result = api.handleRpc(body.method, body.params || {});
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, result }));
      return;
    }
    res.writeHead(404);
    res.end('Not found');
  } catch (err) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Cadence preview → http://127.0.0.1:${PORT}`);
});
