import { ErrorCode } from '@kpata/shared';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  correlation_id?: string;
  user_id?: string;
  component: string;
  action: string;
  duration_ms?: number;
  error_code?: ErrorCode | string;
  meta?: Record<string, unknown>;
}

export interface LogEntry extends LogContext {
  level: LogLevel;
  timestamp: string;
  message: string;
}

class Logger {
  private component: string;

  constructor(component: string) {
    this.component = component;
  }

  private log(level: LogLevel, message: string, context: Partial<LogContext> = {}): void {
    const entry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      correlation_id: context.correlation_id,
      user_id: context.user_id,
      component: context.component || this.component,
      action: context.action || 'unknown',
      duration_ms: context.duration_ms,
      error_code: context.error_code,
      meta: context.meta,
      message,
    };

    const output = JSON.stringify(entry);

    switch (level) {
      case 'error':
        process.stderr.write(output + '\n');
        break;
      default:
        process.stdout.write(output + '\n');
    }
  }

  debug(message: string, context?: Partial<LogContext>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Partial<LogContext>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Partial<LogContext>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Partial<LogContext>): void {
    this.log('error', message, context);
  }

  child(component: string): Logger {
    return new Logger(`${this.component}:${component}`);
  }

  withContext(context: Partial<LogContext>): BoundLogger {
    return new BoundLogger(this, context);
  }
}

class BoundLogger {
  private logger: Logger;
  private context: Partial<LogContext>;

  constructor(logger: Logger, context: Partial<LogContext>) {
    this.logger = logger;
    this.context = context;
  }

  debug(message: string, context?: Partial<LogContext>): void {
    this.logger.debug(message, { ...this.context, ...context });
  }

  info(message: string, context?: Partial<LogContext>): void {
    this.logger.info(message, { ...this.context, ...context });
  }

  warn(message: string, context?: Partial<LogContext>): void {
    this.logger.warn(message, { ...this.context, ...context });
  }

  error(message: string, context?: Partial<LogContext>): void {
    this.logger.error(message, { ...this.context, ...context });
  }
}

export const createLogger = (component: string): Logger => new Logger(component);

export const logger = createLogger('api');
