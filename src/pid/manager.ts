/**
 * PID管理器
 * 职责：进程生命周期管理、信号处理
 */

import { logger } from '@utils/logger.js';
import { writePidFile, readPidFile, removePidFile, pidFileExists } from './file.js';
import type { PidFileOptions } from './types.js';

export class PidManager {
  /**
   * 写入当前进程PID并注册清理钩子
   */
  public static writePid(options?: PidFileOptions): void {
    try {
      writePidFile(process.pid, options);

      // 注册进程退出时的清理钩子
      process.on('exit', () => this.removePid(options));
      process.on('SIGINT', () => {
        this.removePid(options);
        process.exit();
      });
      process.on('SIGTERM', () => {
        this.removePid(options);
        process.exit();
      });
    } catch (error) {
      logger.error('Failed to write PID file:', error);
    }
  }

  /**
   * 删除PID文件
   */
  public static removePid(options?: PidFileOptions): void {
    removePidFile(options);
  }

  /**
   * 获取已保存的PID
   */
  public static getPid(options?: PidFileOptions): number | null {
    return readPidFile(options);
  }

  /**
   * 检查进程是否正在运行
   */
  public static isRunning(options?: PidFileOptions): boolean {
    const pid = this.getPid(options);
    if (!pid) return false;

    try {
      // process.kill(pid, 0) 检查进程是否存在，不会实际杀死进程
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 检查PID文件是否存在
   */
  public static pidFileExists(options?: PidFileOptions): boolean {
    return pidFileExists(options);
  }
}
