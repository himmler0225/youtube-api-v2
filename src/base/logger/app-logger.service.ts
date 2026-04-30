import { Injectable, LoggerService } from "@nestjs/common";
import { inspect } from "util";
import { redact } from "./redact";

type LogLevel = "debug" | "info" | "warn" | "error";

// ── ANSI codes ────────────────────────────────────────────────────────────────
const R = "\x1b[0m"; // reset
const B = "\x1b[1m"; // bold
const D = "\x1b[2m"; // dim

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

// ── Logger ────────────────────────────────────────────────────────────────────
@Injectable()
export class AppLogger implements LoggerService {
  private readonly minLevel: LogLevel;
  private readonly isDev: boolean;

  constructor() {
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) ?? "info";
    this.isDev = process.env.NODE_ENV !== "production";
  }

  // NestJS LoggerService interface
  log(message: unknown, ...rest: unknown[]) {
    this.info(message, rest[0]);
  }
  verbose(message: unknown, ...rest: unknown[]) {
    this.debug(message, rest[0]);
  }
  fatal(message: unknown, ...rest: unknown[]) {
    this.error(message, rest[0]);
  }

  info(message: unknown, meta?: unknown) {
    this.write("info", message, meta);
  }
  warn(message: unknown, meta?: unknown) {
    this.write("warn", message, meta);
  }
  error(message: unknown, meta?: unknown) {
    this.write("error", message, meta);
  }
  debug(message: unknown, meta?: unknown) {
    this.write("debug", message, meta);
  }

  // ── Core write ──────────────────────────────────────────────────────────────
  private write(level: LogLevel, message: unknown, meta?: unknown) {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;

    const msg = typeof message === "string" ? message : JSON.stringify(message);
    const safeMeta = meta !== undefined ? redact(meta) : undefined;

    this.isDev
      ? this.writeDev(level, msg, safeMeta)
      : this.writeProd(level, msg, safeMeta);
  }

  // ── Dev: colored ────────────────────────────────────────────────────────────
  //
  //  12:34:56.123  ›  INFO  User logged in              { userId: 'abc' }
  //  12:34:56.456  ›  WARN  Session expired             { sessionId: 'x' }
  //  12:34:56.789  › ERROR  Crawler unavailable         { path: '/api/video' }
  //
  private writeDev(level: LogLevel, msg: string, meta?: unknown) {
    const time = `${D}${GRAY}${timestamp()}${R}`;
    const arrow = `${D}${CYAN}›${R}`;
    const color = LEVEL_COLOR[level];
    const label = `${color}${LEVEL_LABEL[level]}${R}`;
    const text = msg.padEnd(44);
    const metaStr = meta !== undefined ? `  ${D}${formatMeta(meta)}${R}` : "";

    const line = `  ${time}  ${arrow}  ${label}  ${text}${metaStr}`;

    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  // ── Prod: JSON ──────────────────────────────────────────────────────────────
  private writeProd(level: LogLevel, msg: string, meta?: unknown) {
    const payload: Record<string, unknown> = {
      level,
      time: new Date().toISOString(),
      msg,
    };
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
