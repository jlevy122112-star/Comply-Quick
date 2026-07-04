// Structured logging service.
//
// Part of the Compliance OS shared-services layer. Emits machine-parseable JSON
// in production (one object per line, ready for Vercel/Datadog log drains) and
// human-readable lines in development. Every module should log through here
// rather than calling console.* directly so that context and levels stay
// consistent across the ecosystem.

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export type LogContext = Record<string, unknown>;

export interface LogRecord {
  level: LogLevel;
  message: string;
  time: string;
  context?: LogContext;
}

export interface LoggerOptions {
  /** Minimum level to emit. Anything below is dropped. */
  minLevel?: LogLevel;
  /** Emit single-line JSON (true) or pretty text (false). Defaults by NODE_ENV. */
  json?: boolean;
  /** Bound context merged into every record produced by this logger. */
  bindings?: LogContext;
  /** Sink for records. Defaults to the matching console method. Injectable for tests. */
  sink?: (record: LogRecord) => void;
}

function resolveMinLevel(): LogLevel {
  const fromEnv = process.env.LOG_LEVEL?.toLowerCase();
  if (fromEnv === "debug" || fromEnv === "info" || fromEnv === "warn" || fromEnv === "error") {
    return fromEnv;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function defaultSink(record: LogRecord, json: boolean): void {
  const method = record.level === "debug" ? "log" : record.level;
  if (json) {
    console[method](JSON.stringify(record));
    return;
  }
  const ctx = record.context && Object.keys(record.context).length > 0 ? ` ${JSON.stringify(record.context)}` : "";
  console[method](`${record.time} ${record.level.toUpperCase()} ${record.message}${ctx}`);
}

export class Logger {
  private readonly minLevel: LogLevel;
  private readonly json: boolean;
  private readonly bindings: LogContext;
  private readonly sink: (record: LogRecord) => void;

  constructor(options: LoggerOptions = {}) {
    this.minLevel = options.minLevel ?? resolveMinLevel();
    this.json = options.json ?? process.env.NODE_ENV === "production";
    this.bindings = options.bindings ?? {};
    const json = this.json;
    this.sink = options.sink ?? ((record) => defaultSink(record, json));
  }

  /** Returns a new logger that merges the given bindings into every record. */
  child(bindings: LogContext): Logger {
    return new Logger({
      minLevel: this.minLevel,
      json: this.json,
      bindings: { ...this.bindings, ...bindings },
      sink: this.sink,
    });
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[this.minLevel]) return;
    const merged = { ...this.bindings, ...context };
    const record: LogRecord = {
      level,
      message,
      time: new Date().toISOString(),
      ...(Object.keys(merged).length > 0 ? { context: merged } : {}),
    };
    this.sink(record);
  }

  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }
  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }
  warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }
  error(message: string, context?: LogContext): void {
    this.log("error", message, context);
  }
}

/** Shared application logger. Use `logger.child({ module: "scanner" })` per module. */
export const logger = new Logger();
