import * as esbuild from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync, cpSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

mkdirSync(join(__dirname, 'dist'), { recursive: true });

const shared = {
  bundle: true,
  sourcemap: true,
  logLevel: 'info',
  target: 'es2022',
};

async function build() {
  const extension = await esbuild.context({
    ...shared,
    entryPoints: [join(__dirname, 'src/activate.ts')],
    outfile: join(__dirname, 'dist/extension.js'),
    platform: 'node',
    format: 'cjs',
    external: ['vscode'],
    define: { 'process.env.CADENCE_BUILD': '"extension"' },
  });

  const webview = await esbuild.context({
    ...shared,
    entryPoints: [join(__dirname, 'src/ui/app.ts')],
    outfile: join(__dirname, 'dist/webview.js'),
    platform: 'browser',
    format: 'iife',
    globalName: 'CadenceApp',
  });

  const worker = await esbuild.context({
    ...shared,
    entryPoints: [join(__dirname, 'src/ingest/workers/parse-worker.ts')],
    outfile: join(__dirname, 'dist/parse-worker.js'),
    platform: 'node',
    format: 'cjs',
  });

  const cli = await esbuild.context({
    ...shared,
    entryPoints: [join(__dirname, 'src/cli/main.ts')],
    outfile: join(__dirname, 'dist/cli.cjs'),
    platform: 'node',
    format: 'cjs',
    external: ['vscode'],
  });

  const cssPath = join(__dirname, 'src/ui/theme.css');
  const cssOut = join(__dirname, 'dist/webview.css');
  const copyCss = () => writeFileSync(cssOut, readFileSync(cssPath, 'utf8'));
  copyCss();

  if (existsSync(join(__dirname, 'src/signals/rules'))) {
    cpSync(join(__dirname, 'src/signals/rules'), join(__dirname, 'dist/signals/rules'), { recursive: true });
  }
  if (existsSync(join(__dirname, 'src/signals/metrics'))) {
    cpSync(join(__dirname, 'src/signals/metrics'), join(__dirname, 'dist/signals/metrics'), { recursive: true });
  }

  if (watch) {
    await Promise.all([extension.watch(), webview.watch(), worker.watch(), cli.watch()]);
    console.log('watching…');
  } else {
    await Promise.all([extension.rebuild(), webview.rebuild(), worker.rebuild(), cli.rebuild()]);
    await Promise.all([extension.dispose(), webview.dispose(), worker.dispose(), cli.dispose()]);
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
