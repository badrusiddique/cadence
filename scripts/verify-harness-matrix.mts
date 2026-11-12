/**
 * Isolated real-prompt verification for every Cadence harness.
 * Uses this project's conversation marker, not demo fixtures.
 *
 *   npx tsx scripts/verify-harness-matrix.mts
 */
import { spawnSync } from 'child_process';
import * as path from 'path';

const script = path.join('/tmp/harness-verify/verify-all.mts');
const r = spawnSync('npx', ['--yes', 'tsx', script], {
  cwd: path.join(path.dirname(new URL(import.meta.url).pathname), '..'),
  stdio: 'inherit',
  env: process.env,
});
process.exit(r.status ?? 1);
