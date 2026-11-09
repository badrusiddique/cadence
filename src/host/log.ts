/**
 * Structured diagnostics for the Cadence Output channel.
 * Safe for enterprise: never logs full prompt bodies by default.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface CadenceLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  show(preserveFocus?: boolean): void;
}

type Sink = { appendLine(value: string): void; show?(preserveFocus?: boolean): void };

function fmt(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const extra = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `[${ts}] ${level.toUpperCase()} ${message}${extra}`;
}

export function createLogger(sink: Sink): CadenceLogger {
  return {
    info: (message, meta) => sink.appendLine(fmt('info', message, meta)),
    warn: (message, meta) => sink.appendLine(fmt('warn', message, meta)),
    error: (message, meta) => sink.appendLine(fmt('error', message, meta)),
    show: (preserveFocus) => sink.show?.(preserveFocus),
  };
}

/** Console fallback for CLI / tests. */
export function createConsoleLogger(): CadenceLogger {
  return {
    info: (m, meta) => console.log(fmt('info', m, meta)),
    warn: (m, meta) => console.warn(fmt('warn', m, meta)),
    error: (m, meta) => console.error(fmt('error', m, meta)),
    show: () => undefined,
  };
}
