import fs from 'fs';
import path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private level: LogLevel = 'info';
  private useStderr: boolean = false;
  private logFileStream: fs.WriteStream | null = null;

  constructor(level: LogLevel = 'info') {
    this.level = level;

    // 检查是否启用了开发日志文件
    if (process.env.DEV_LOG_FILE) {
      this.enableDevLog();
    }
  }

  public enableDevLog() {
    if (this.logFileStream) return;

    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, 'dev-server.log');

    // 开发模式下清空日志文件，避免过期日志干扰
    if (fs.existsSync(logFile)) {
      fs.truncateSync(logFile, 0);
    }

    this.logFileStream = fs.createWriteStream(logFile, { flags: 'a' });
    console.log(`[DEV LOG] Writing logs to: ${logFile} (cleared on startup)`);
  }

  public setUseStderr(use: boolean) {
      this.useStderr = use;
  }

  private shouldLog(messageLevel: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(messageLevel) >= levels.indexOf(this.level);
  }

  private formatTimestamp(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  }

  private createLogMessage(level: LogLevel, message: string, pid?: number): string {
    const timestamp = this.formatTimestamp(new Date());
    const processPid = pid ?? process.pid;
    return `[${timestamp}] [${level.toUpperCase()}] [PID:${processPid}] ${message}`;
  }

  // 辅助方法：格式化错误对象
  private formatError(error: unknown): string {
    if (error instanceof Error) {
      let result = error.message;
      if (error.stack) {
        // 添加堆栈跟踪，但限制长度以避免过长
        const stackLines = error.stack.split('\n').slice(1, 6); // 取前5行堆栈
        if (stackLines.length > 0) {
          result += '\n' + stackLines.join('\n');
        }
      }
      return result;
    }
    return String(error);
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      // 处理多个参数
      let fullMessage = message;
      if (args.length > 0) {
        const formattedArgs = args.map(arg => this.formatError(arg)).join(' ');
        fullMessage = `${message} ${formattedArgs}`;
      }

      const logMsg = this.createLogMessage('debug', fullMessage);
      if (this.useStderr) {
          console.error(logMsg);
      } else {
          console.debug(logMsg);
      }

      // 文件输出（如果启用）
      if (this.logFileStream) {
        this.logFileStream.write(logMsg + '\n');
      }
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      // 处理多个参数
      let fullMessage = message;
      if (args.length > 0) {
        const formattedArgs = args.map(arg => this.formatError(arg)).join(' ');
        fullMessage = `${message} ${formattedArgs}`;
      }

      const logMsg = this.createLogMessage('info', fullMessage);
      if (this.useStderr) {
          console.error(logMsg);
      } else {
          console.info(logMsg);
      }

      // 文件输出（如果启用）
      if (this.logFileStream) {
        this.logFileStream.write(logMsg + '\n');
      }
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      // 处理多个参数
      let fullMessage = message;
      if (args.length > 0) {
        const formattedArgs = args.map(arg => this.formatError(arg)).join(' ');
        fullMessage = `${message} ${formattedArgs}`;
      }

      const logMsg = this.createLogMessage('warn', fullMessage);
      console.warn(logMsg);

      // 文件输出（如果启用）
      if (this.logFileStream) {
        this.logFileStream.write(logMsg + '\n');
      }
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      // 处理多个参数
      let fullMessage = message;
      if (args.length > 0) {
        const formattedArgs = args.map(arg => this.formatError(arg)).join(' ');
        fullMessage = `${message} ${formattedArgs}`;
      }

      const logMsg = this.createLogMessage('error', fullMessage);
      console.error(logMsg);

      // 文件输出（如果启用）
      if (this.logFileStream) {
        this.logFileStream.write(logMsg + '\n');
      }
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

export const logger = new Logger();

/**
 * 检查数据是否为 tools/list 响应
 * @param data stdout 或响应数据
 * @returns 如果是 tools/list 响应返回 true
 */
export function isToolsListResponse(data: string): boolean {
  try {
    const trimmed = data.trim();
    if (trimmed.startsWith('{')) {
      const message = JSON.parse(trimmed) as any;
      // 检查是否为响应且包含 tools 或 resources 字段
      if (message.result && typeof message.result === 'object') {
        // 匹配 tools/list 响应格式: {"result":{"tools": [...]} }
        if ('tools' in message.result) {
          return true;
        }
        // 匹配 resources/list 响应格式: {"result":{"resources": [...]} }
        if ('resources' in message.result) {
          return true;
        }
        // 匹配 initialize 响应格式: {"result":{"capabilities":{"tools": {...}} } }
        if (message.result.capabilities &&
            typeof message.result.capabilities === 'object' &&
            ('tools' in message.result.capabilities || 'resources' in message.result.capabilities)) {
          return true;
        }
      }
    }
  } catch {
    // 非JSON数据，忽略
  }
  return false;
}