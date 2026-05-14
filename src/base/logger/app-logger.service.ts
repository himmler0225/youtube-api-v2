import { Injectable, LoggerService } from "@nestjs/common";
import { inspect } from "util";
import { redact } from "./redact";

type LogLevel = "debug" | "info" | "warn" | "error";

// ── ANSI codes ────────────────────────────────────────────────────────────────
const R = "\x1b[0m";
const B = "\x1b[1m";
const D = "\x1b[2m";

const GRAY = "\x1b[90m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const MAGENTA = "\x1b[35m";

// ── Level config ──────────────────────────────────────────────────────────────
const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: GRAY,
  info: `${B}${GREEN}`,
  warn: `${B}${YELLOW}`,
  error: `${B}${RED}`,
};

const LEVEL_LABEL: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: " INFO",
  warn: " WARN",
  error: "ERROR",
};

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function timestamp(): string {
  const n = new Date();
  const hh = n.getHours().toString().padStart(2, "0");
  const mm = n.getMinutes().toString().padStart(2, "0");
  const ss = n.getSeconds().toString().padStart(2, "0");
  const ms = n.getMilliseconds().toString().padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function formatMeta(meta: unknown): string {
  return inspect(meta, {
    colors: true,
    depth: 5,
    compact: true,
    breakLength: 120,
  });
}

// Extract the first stack frame that belongs to project source (not node_modules / node internals)
export function parseOrigin(stack?: string): string | undefined {
  if (!stack) return undefined;
  const cwd = process.cwd();
  for (const line of stack.split("\n").slice(1)) {
    const m =
      line.match(/at .+? \((.+?):(\d+):(\d+)\)/) ??
      line.match(/at (.+?):(\d+):(\d+)/);
    if (!m) continue;
    const file = m[1];
    if (file.includes("node_modules") || file.startsWith("node:")) continue;
    const rel = file.startsWith(cwd) ? file.slice(cwd.length + 1) : file;
    return `${rel}:${m[2]}`;
  }
  return undefined;
}

// ── Logger ────────────────────────────────────────────────────────────────────
@Injectable()
export class AppLogger implements LoggerService {
  private readonly minLevel: LogLevel;
  private readonly isDev: boolean;

  constructor() {
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) ?? "info";
    this.isDev = process.env.NODE_ENV !== "production";
  }

  // NestJS LoggerService interface — context is the class name NestJS passes
  log(message: unknown, context?: string) {
    this.info(String(message), undefined, context);
  }
  verbose(message: unknown, context?: string) {
    this.debug(String(message), undefined, context);
  }
  fatal(message: unknown, context?: string) {
    this.error(String(message), undefined, context);
  }
  warn(message: unknown, context?: string): void;
  warn(message: unknown, meta?: unknown, context?: string): void;
  warn(message: unknown, metaOrCtx?: unknown, context?: string) {
    const [meta, ctx] = resolveOverload(metaOrCtx, context);
    this.write("warn", message, meta, ctx);
  }
  error(message: unknown, context?: string): void;
  error(message: unknown, meta?: unknown, context?: string): void;
  error(message: unknown, metaOrCtx?: unknown, context?: string) {
    const [meta, ctx] = resolveOverload(metaOrCtx, context);
    this.write("error", message, meta, ctx);
  }

  info(message: unknown, meta?: unknown, context?: string) {
    this.write("info", message, meta, context);
  }
  debug(message: unknown, meta?: unknown, context?: string) {
    this.write("debug", message, meta, context);
  }

  // ── Core write ──────────────────────────────────────────────────────────────
  private write(
    level: LogLevel,
    message: unknown,
    meta?: unknown,
    context?: string,
  ) {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;

    const msg = typeof message === "string" ? message : JSON.stringify(message);
    const safeMeta = meta !== undefined ? redact(meta) : undefined;

    this.isDev
      ? this.writeDev(level, msg, safeMeta, context)
      : this.writeProd(level, msg, safeMeta, context);
  }

  // ── Dev: colored ────────────────────────────────────────────────────────────
  //
  //  12:34:56.123  ›   INFO  [AuthService]  User logged in            { userId: 'abc' }
  //  12:34:56.456  ›   WARN  [AuthService]  Invalid credentials       { code: 'INVALID_CREDENTIALS' }
  //  12:34:56.789  ›  ERROR  [Filter]       Unhandled error           { file: 'src/modules/video.service.ts:45' }
  //
  private writeDev(
    level: LogLevel,
    msg: string,
    meta?: unknown,
    context?: string,
  ) {
    const time = `${D}${GRAY}${timestamp()}${R}`;
    const arrow = `${D}${CYAN}›${R}`;
    const color = LEVEL_COLOR[level];
    const label = `${color}${LEVEL_LABEL[level]}${R}`;
    const ctx = context ? `  ${MAGENTA}[${context}]${R}` : "";
    const text = msg.padEnd(44);
    const metaStr = meta !== undefined ? `  ${D}${formatMeta(meta)}${R}` : "";

    const line = `  ${time}  ${arrow}  ${label}${ctx}  ${text}${metaStr}`;

    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  // ── Prod: JSON ──────────────────────────────────────────────────────────────
  private writeProd(
    level: LogLevel,
    msg: string,
    meta?: unknown,
    context?: string,
  ) {
    const payload: Record<string, unknown> = {
      level,
      time: new Date().toISOString(),
      msg,
    };
    if (context) payload["context"] = context;
    if (meta !== undefined) payload["meta"] = meta;

    const out = JSON.stringify(payload);

    if (level === "error") {
      console.error(out);
    } else if (level === "warn") {
      console.warn(out);
    } else {
      console.log(out);
    }
  }
}

// Handles warn/error(msg, meta?, context?) overloads
function resolveOverload(
  metaOrCtx: unknown,
  context: string | undefined,
): [unknown, string | undefined] {
  if (context !== undefined) return [metaOrCtx, context];
  if (typeof metaOrCtx === "string") return [undefined, metaOrCtx];
  return [metaOrCtx, undefined];
}
