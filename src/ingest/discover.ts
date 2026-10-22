import { findClaudeDirs } from './harnesses/claude';
import { findCodexDirs } from './harnesses/codex';
import { findCopilotCliDirs } from './harnesses/copilot-cli';
import { findCursorDirs } from './harnesses/cursor';
import { findOpenCodeDirs } from './harnesses/opencode';
import { findVsCodeDirs } from './harnesses/vscode';

export interface DiscoveredSources {
  vscode: string[];
  claude: string[];
  codex: string[];
  opencode: string[];
  copilotCli: string[];
  cursor: string[];
}

export function discoverSources(): DiscoveredSources {
  return {
    vscode: findVsCodeDirs(),
    claude: findClaudeDirs(),
    codex: findCodexDirs(),
    opencode: findOpenCodeDirs(),
    copilotCli: findCopilotCliDirs(),
    cursor: findCursorDirs(),
  };
}

export function hasAnySources(sources = discoverSources()): boolean {
  return Object.values(sources).some((dirs) => dirs.length > 0);
}

export function flattenSourcePaths(sources = discoverSources()): string[] {
  return Object.values(sources).flat();
}
