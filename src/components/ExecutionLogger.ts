import { ExecutionLog, LogLevel } from '../types/index.js';

export class ExecutionLogger {
  private logs: ExecutionLog[] = [];
  private logLevel: LogLevel;

  constructor(logLevel: LogLevel = 'INFO') {
    this.logLevel = logLevel;
  }

  /**
   * Log a message
   */
  log(level: LogLevel, step: string, details: Record<string, any> = {}): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const log: ExecutionLog = {
      timestamp: Date.now(),
      level,
      step,
      details,
    };

    this.logs.push(log);

    // Also output to console for debugging
    if (process.env.NODE_ENV !== 'test') {
      this.outputToConsole(log);
    }
  }

  /**
   * Log debug message
   */
  debug(step: string, details: Record<string, any> = {}): void {
    this.log('DEBUG', step, details);
  }

  /**
   * Log info message
   */
  info(step: string, details: Record<string, any> = {}): void {
    this.log('INFO', step, details);
  }

  /**
   * Log warning message
   */
  warn(step: string, details: Record<string, any> = {}): void {
    this.log('WARN', step, details);
  }

  /**
   * Log error message
   */
  error(step: string, details: Record<string, any> = {}): void {
    this.log('ERROR', step, details);
  }

  /**
   * Get all logs
   */
  getLogs(): ExecutionLog[] {
    return [...this.logs];
  }

  /**
   * Get logs filtered by level
   */
  getLogsByLevel(level: LogLevel): ExecutionLog[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Export logs as JSON string
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Set log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Check if a message should be logged based on level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Output log to console
   */
  private outputToConsole(log: ExecutionLog): void {
    const timestamp = new Date(log.timestamp).toISOString();
    const prefix = `[${timestamp}] [${log.level}]`;

    const message = `${prefix} ${log.step}`;
    const hasDetails = Object.keys(log.details).length > 0;

    switch (log.level) {
      case 'DEBUG':
        console.debug(message, hasDetails ? log.details : '');
        break;
      case 'INFO':
        console.log(message, hasDetails ? log.details : '');
        break;
      case 'WARN':
        console.warn(message, hasDetails ? log.details : '');
        break;
      case 'ERROR':
        console.error(message, hasDetails ? log.details : '');
        break;
    }
  }
}
