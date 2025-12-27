export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private level: LogLevel = 'info';
  private useStderr: boolean = false;

  constructor(level: LogLevel = 'info') {
    this.level = level;
  }
  
  public setUseStderr(use: boolean) {
      this.useStderr = use;
  }

  private shouldLog(messageLevel: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(messageLevel) >= levels.indexOf(this.level);
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      if (this.useStderr) {
          console.error(`[DEBUG] ${message}`, ...args);
      } else {
          console.debug(`[DEBUG] ${message}`, ...args);
      }
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      if (this.useStderr) {
          console.error(`[INFO] ${message}`, ...args);
      } else {
          console.info(`[INFO] ${message}`, ...args);
      }
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

export const logger = new Logger();
