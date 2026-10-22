#!/usr/bin/env node
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { createRequire } from 'module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outfile = join(root, 'dist', 'cli.cjs');

async function ensureCli() {
  if (existsSync(outfile)) return;
  const require = createRequire(import.meta.url);
  const esbuild = require('esbuild');
  await esbuild.build({
    entryPoints: [join(root, 'src/cli/main.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile,
    sourcemap: false,
    external: ['vscode'],
  });
}

await ensureCli();
const child = spawn(process.execPath, [outfile, ...process.argv.slice(2)], {
  stdio: 'inherit',
});
child.on('exit', (code) => process.exit(code ?? 1));
