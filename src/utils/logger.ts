import fs from 'fs';
import path from 'path';
import type { LogLevel } from '@shared-types/common.types.js';

export interface LogContext {
  pid?: number;
  serverName?: string;
  subModule?: string;
  traceId?: string;
  spanId?: string;
}

export type LogOptions = Omit<LogContext, 'pid' | 'serverName'>;

// PID 格式化配置
const PID_WIDTH = 8;

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

    // Enable dev logging to file via environment variable
    process.env.DEV_LOG_FILE = '1';

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
    this.debug(`[DEV LOG] Writing logs to: ${logFile} (cleared on startup)`);
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

  // ANSI 颜色代码
  private getColorCodeForLevel(level: LogLevel): string {
    switch (level) {
      case 'debug': return '\x1b[36m'; // 青色
      case 'info': return '\x1b[32m';  // 绿色
      case 'warn': return '\x1b[33m';  // 黄色
      case 'error': return '\x1b[31m'; // 红色
      default: return '\x1b[0m';
    }
  }

  private getResetColor(): string {
    return '\x1b[0m';
  }

  private formatLogLevel(level: LogLevel): string {
    switch (level) {
      case 'debug': return 'DBG';
      case 'info': return 'INF';
      case 'warn': return 'WRN';
      case 'error': return 'ERR';
      default:
        // 这个分支在TypeScript中实际上不会到达，因为LogLevel是联合类型
        // 但为了编译通过，我们返回一个默认值
        return 'UNK';
    }
  }

  private formatPid(pid: number): string {
    // 固定宽度用于数字部分，右对齐，不足补空格
    const pidStr = pid.toString();
    if (pidStr.length > PID_WIDTH) {
      return `PID:${pidStr.substring(0, PID_WIDTH)}`; // 截断超长的PID
    }
    return `PID:${pidStr.padStart(PID_WIDTH, ' ')}`;
  }

  private createColoredLogMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = this.formatTimestamp(new Date());
    const processPid = context?.pid ?? process.pid;
    const formattedLevel = this.formatLogLevel(level);
    const formattedPid = this.formatPid(processPid);
    const actualServerName = context?.serverName || 'mcp-hub';

    // 时间戳 - 白色/灰色
    const timestampColor = '\x1b[90m';
    // 日志级别 - 根据级别着色
    const levelColor = this.getColorCodeForLevel(level);
    // PID - 青色
    const pidColor = '\x1b[36m';
    // 服务器名称或 mcp-hub - 淡青色（亮青色）
    const serverColor = '\x1b[96m';
    // 子模块 - 淡紫色
    const subModuleColor = '\x1b[95m';
    // TraceId 和 SpanId - 黄色
    const traceColor = '\x1b[33m';
    // 重置颜色
    const resetColor = this.getResetColor();

    let result = `${timestampColor}[${timestamp}]${resetColor} ${levelColor}[${formattedLevel}]${resetColor} ${pidColor}[${formattedPid}]${resetColor}`;

    if (context?.traceId) {
      result += ` ${traceColor}[TID:${context.traceId}]${resetColor}`;
    }

    if (context?.spanId) {
      result += ` ${traceColor}[SID:${context.spanId}]${resetColor}`;
    }

    result += ` ${serverColor}[${actualServerName}]${resetColor}`;

    if (context?.subModule) {
      result += ` ${subModuleColor}[${context.subModule}]${resetColor}`;
    }

    result += ` ${message}`;
    return result;
  }

  private createLogMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = this.formatTimestamp(new Date());
    const processPid = context?.pid ?? process.pid;
    const formattedLevel = this.formatLogLevel(level);
    // 对于纯文本日志，PID 格式保持简单
    const pidStr = processPid.toString().padStart(PID_WIDTH, ' ');
    const serverIdentifier = context?.serverName || 'mcp-hub';

    let result = `[${timestamp}] [${formattedLevel}] [PID:${pidStr}]`;

    if (context?.traceId) {
      result += ` [TID:${context.traceId}]`;
    }

    if (context?.spanId) {
      result += ` [SID:${context.spanId}]`;
    }

    result += ` [${serverIdentifier}]`;

    if (context?.subModule) {
      result += ` [${context.subModule}]`;
    }

    result += ` ${message}`;
    return result;
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
    // 对于非 Error 对象的参数，我们需要正确地格式化它们
    if (typeof error === 'object' && error !== null) {
      // 检查是否是 LogOptions 对象
      if ('subModule' in error || 'traceId' in error || 'spanId' in error) {
        // 如果是 LogOptions 对象，我们应该忽略它，因为它不应该被作为参数输出
        return '';
      }
      // 检查是否是空数组或空对象
      if (Array.isArray(error) && error.length === 0) {
        return '';
      }
      if (Object.keys(error).length === 0) {
        return '';
      }
      // 对于其他对象，我们应该将其转换为 JSON 字符串
      try {
        return JSON.stringify(error);
      } catch {
        return String(error);
      }
    }
    return String(error);
  }

  // 通用日志方法，消除代码重复
  private log(level: LogLevel, message: string, args: unknown[], options?: LogOptions): void {
    if (!this.shouldLog(level)) {
      return;
    }

    // 处理多个参数
    let fullMessage = message;
    if (args.length > 0) {
      const formattedArgs = args.map(arg => this.formatError(arg)).join(' ');
      fullMessage = `${message} ${formattedArgs}`;
    }

    // 将 LogOptions 转换为 LogContext
    const context: LogContext | undefined = options ? {
      subModule: options.subModule,
      traceId: options.traceId,
      spanId: options.spanId
    } : undefined;

    const coloredLogMsg = this.createColoredLogMessage(level, fullMessage, context);
    const plainLogMsg = this.createLogMessage(level, fullMessage, context);

    // 控制台输出
    if (this.useStderr) {
      console.error(coloredLogMsg);
    } else {
      switch (level) {
        case 'debug':
          console.debug(coloredLogMsg);
          break;
        case 'info':
          console.info(coloredLogMsg);
          break;
        case 'warn':
          console.warn(coloredLogMsg);
          break;
        case 'error':
          console.error(coloredLogMsg);
          break;
      }
    }

    // 文件输出（如果启用）- 使用纯文本格式
    if (this.logFileStream) {
      this.logFileStream.write(plainLogMsg + '\n');
    }
  }

  debug(message: string, ...args: unknown[]): void {
    const [options, ...restArgs] = this.extractOptionsAndArgs(args);
    this.log('debug', message, restArgs, options);
  }

  info(message: string, ...args: unknown[]): void {
    const [options, ...restArgs] = this.extractOptionsAndArgs(args);
    this.log('info', message, restArgs, options);
  }

  warn(message: string, ...args: unknown[]): void {
    const [options, ...restArgs] = this.extractOptionsAndArgs(args);
    this.log('warn', message, restArgs, options);
  }

  error(message: string, ...args: unknown[]): void {
    const [options, ...restArgs] = this.extractOptionsAndArgs(args);
    this.log('error', message, restArgs, options);
  }

  private extractOptionsAndArgs(args: unknown[]): [LogOptions | undefined, unknown[]] {
    if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
      const firstArg = args[0] as Record<string, unknown>;
      if ('subModule' in firstArg || 'traceId' in firstArg || 'spanId' in firstArg) {
        return [args[0] as LogOptions, args.slice(1)];
      }
    }
    return [undefined, args];
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  // 专门用于MCP Server日志的方法
  serverLog(level: LogLevel, serverName: string, message: string, context?: Omit<LogContext, 'serverName'>): void {
    if (this.shouldLog(level)) {
      const logContext: LogContext = {
        ...context,
        serverName
      };
      const coloredLogMsg = this.createColoredLogMessage(level, message, logContext);
      const plainLogMsg = this.createLogMessage(level, message, logContext);

      // 使用正确的控制台方法
      if (this.useStderr) {
        console.error(coloredLogMsg);
      } else {
        switch (level) {
          case 'debug':
            console.debug(coloredLogMsg);
            break;
          case 'info':
            console.info(coloredLogMsg);
            break;
          case 'warn':
            console.warn(coloredLogMsg);
            break;
          case 'error':
            console.error(coloredLogMsg);
            break;
        }
      }

      // 文件输出（如果启用）- 使用纯文本格式
      if (this.logFileStream) {
        this.logFileStream.write(plainLogMsg + '\n');
      }
    }
  }
}

export const logger = new Logger();

/**
 * 带颜色的日志记录函数
 * @param coloredMessage 控制台显示的消息（包含 ANSI 颜色代码）
 * @param plainMessage 文件日志的消息（纯文本）
 */
export function logWithColor(coloredMessage: string, plainMessage: string, context?: LogContext): void {
  // 使用新的颜色格式
  const coloredLogMsg = logger['createColoredLogMessage']('info', coloredMessage, context);
  console.info(coloredLogMsg);

  // 文件输出（无颜色）- 直接使用 createLogMessage 方法
  if (logger['logFileStream']) {
    const plainLogMsg = logger['createLogMessage']('info', plainMessage, context);
    logger['logFileStream'].write(plainLogMsg + '\n');
  }
}