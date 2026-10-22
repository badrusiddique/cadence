#!/usr/bin/env node
/**
 * Print / optionally write a Cadence MCP registration snippet.
 * Fail-closed: never writes without --yes; always shows the plan first (REA setup ethos).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';

const args = process.argv.slice(2);
const yes = args.includes('--yes');
const client = args.includes('--client') ? args[args.indexOf('--client') + 1] : 'cursor';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const command = process.execPath;
const script = path.join(root, 'scripts', 'cadence.mjs');

const snippet = {
  mcpServers: {
    cadence: {
      command,
      args: [script, 'mcp'],
    },
  },
};

const targets = {
  cursor: path.join(os.homedir(), '.cursor', 'mcp.json'),
  vscode: path.join(os.homedir(), '.vscode', 'mcp.json'),
};

const target = targets[client] || targets.cursor;

console.log('Cadence MCP setup plan');
console.log('----------------------');
console.log(`Client : ${client}`);
console.log(`Target : ${target}`);
console.log('Config :');
console.log(JSON.stringify(snippet, null, 2));
console.log('');
console.log('This will merge the `cadence` server key into the target file.');
console.log('No unrelated software will be installed.');

if (!yes) {
  console.log('\nDry run only. Re-run with --yes to write after you approve.');
  process.exit(0);
}

let existing = {};
if (fs.existsSync(target)) {
  const backup = `${target}.cadence-backup-${Date.now()}`;
  fs.copyFileSync(target, backup);
  console.log(`Backup : ${backup}`);
  try {
    existing = JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch {
    existing = {};
  }
} else {
  fs.mkdirSync(path.dirname(target), { recursive: true });
}

existing.mcpServers = { ...(existing.mcpServers || {}), ...snippet.mcpServers };
fs.writeFileSync(target, JSON.stringify(existing, null, 2) + '\n');
console.log(`Wrote  : ${target}`);
console.log('Restart your agent so Cadence MCP tools appear.');
