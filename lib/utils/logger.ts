/**
 * Environment-aware logging utility for BetterAt
 *
 * Usage:
 *   const logger = createLogger('ComponentName');
 *   logger.debug('Debug info', { data }); // Only when LOG_LEVEL allows
 *   logger.info('Info message');           // Only when LOG_LEVEL allows
 *   logger.warn('Warning message');        // Respects LOG_LEVEL (defaults to warn)
 *   logger.error('Error occurred', error); // Always logged
 *
 * Verbosity Control:
 *   Set EXPO_PUBLIC_LOG_LEVEL to one of: debug | info | warn | error
 *   Defaults to `warn` when not set.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const reactNativeDevFlag = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
const isDevelopment = reactNativeDevFlag || process.env.NODE_ENV === 'development';

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const parseLogLevel = (value?: string | null): LogLevel | null => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === 'debug' || normalized === 'info' || normalized === 'warn' || normalized === 'error') {
    return normalized;
  }
  return null;
};

const envLogLevel = parseLogLevel(process.env.EXPO_PUBLIC_LOG_LEVEL as string | undefined);
// Default to 'error' for clean logs; set EXPO_PUBLIC_LOG_LEVEL=warn for more verbose logging
const DEFAULT_MIN_LEVEL: LogLevel = envLogLevel ?? 'error';

class Logger {
  private context: string;
  private minLevel: LogLevel;

  constructor(context: string) {
    this.context = context;
    this.minLevel = DEFAULT_MIN_LEVEL;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[this.minLevel];
  }

  /**
   * Debug-level logging - only shown in development
   * Use for detailed debugging information
   * Respects verbosity settings for noisy contexts
   */
  debug(...args: any[]) {
    if (!isDevelopment) return;
    if (!this.shouldLog('debug')) return;
    console.log(`[${this.context}]`, ...args);
  }

  /**
   * Info-level logging - only shown in development
   * Use for general informational messages
   * Respects verbosity settings for noisy contexts
   */
  info(...args: any[]) {
    if (!isDevelopment) return;
    if (!this.shouldLog('info')) return;
    console.info(`[${this.context}]`, ...args);
  }

  /**
   * Warning-level logging - shown when LOG_LEVEL <= warn (defaults to warn)
   * Use for non-critical issues that should be addressed
   */
  warn(...args: any[]) {
    if (!this.shouldLog('warn')) return;
    console.warn(`[${this.context}]`, ...args);
  }

  /**
   * Error-level logging - always shown
   * Use for errors and exceptions
   */
  error(...args: any[]) {
    console.error(`[${this.context}]`, ...args);
  }

  /**
   * Creates a child logger with nested context
   * Example: logger.child('SubComponent') creates '[ParentContext:SubComponent]'
   */
  child(subContext: string): Logger {
    return new Logger(`${this.context}:${subContext}`);
  }
}

/**
 * Creates a new logger instance with the given context
 * @param context - The context/component name for the logger
 * @returns Logger instance
 */
export const createLogger = (context: string): Logger => {
  return new Logger(context);
};

/**
 * Default logger for global use
 */
export const logger = createLogger('App');

/**
 * Serialize an error for logging
 * Error objects have non-enumerable properties, so JSON.stringify returns {}
 * This helper extracts the useful information for logging
 */
export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const result: Record<string, unknown> = {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
    // Include any custom properties
    for (const key of Object.getOwnPropertyNames(error)) {
      if (key !== 'message' && key !== 'name' && key !== 'stack') {
        result[key] = (error as unknown as Record<string, unknown>)[key];
      }
    }
    return result;
  }
  if (typeof error === 'object' && error !== null) {
    return error as Record<string, unknown>;
  }
  return { value: String(error) };
}
