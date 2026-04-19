import { Injectable, LoggerService } from '@nestjs/common';
import { redact } from './redact';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

@Injectable()
export class AppLogger implements LoggerService {
  private level: LogLevel;

  constructor() {
    this.level = (process.env.LOG_LEVEL as LogLevel) || 'info';
  }

  log(message: unknown, ...optionalParams: unknown[]) {
    this.info(message, optionalParams[0]);
  }

  info(message: unknown, meta?: unknown) {
    this.write('info', message, meta);
  }

  warn(message: unknown, meta?: unknown) {
    this.write('warn', message, meta);
  }

  error(message: unknown, meta?: unknown) {
    this.write('error', message, meta);
  }

  debug(message: unknown, meta?: unknown) {
    this.write('debug', message, meta);
  }

  private write(level: LogLevel, message: unknown, meta?: unknown) {
    if (!this.shouldLog(level)) return;

    const payload = {
      level,
      time: new Date().toISOString(),
      msg: typeof message === 'string' ? message : JSON.stringify(message),
      meta: meta ? redact(meta) : undefined,
    };

    const consoleMethod = level === 'debug' ? 'log' : level;
    console[consoleMethod](JSON.stringify(payload));
  }

  private shouldLog(level: LogLevel) {
    const order: Record<LogLevel, number> = {
      debug: 10,
      info: 20,
      warn: 30,
      error: 40,
    };
    return order[level] >= order[this.level];
  }
}
