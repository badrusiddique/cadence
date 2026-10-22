import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export function homeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

export function existsDir(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export function listDirs(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}

export function walkFiles(dir: string, pred: (name: string) => boolean, acc: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, pred, acc);
    else if (entry.isFile() && pred(entry.name)) acc.push(full);
  }
  return acc;
}

/** Trusted roots Cadence is allowed to read. */
export function trustedRoots(): string[] {
  const home = homeDir();
  return [
    path.join(home, '.claude'),
    path.join(home, '.codex'),
    path.join(home, '.local', 'share', 'opencode'),
    path.join(home, 'Library', 'Application Support', 'opencode'),
    path.join(home, '.config'),
    path.join(home, '.copilot'),
    path.join(home, '.cursor'),
    path.join(home, 'Library', 'Application Support'),
    path.join(home, '.vscode-server'),
    path.join(home, '.vscode-server-insiders'),
    process.env.APPDATA || '',
  ].filter(Boolean);
}

export function assertTrustedPath(target: string): void {
  const resolved = path.resolve(target);
  const ok = trustedRoots().some((root) => {
    const r = path.resolve(root);
    return resolved === r || resolved.startsWith(r + path.sep);
  });
  if (!ok) throw new Error(`Refusing to read untrusted path: ${resolved}`);
}
