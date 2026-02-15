/**
 * PID Manager
 * Responsibility: Process lifecycle management and signal handling
 */

import { logger } from '@utils/logger.js';
import { writePidFile, readPidFile, removePidFile, pidFileExists } from './file.js';
import type { PidFileOptions } from './types.js';

export class PidManager {
  /**
   * Write current process PID and register cleanup hooks
   */
  public static writePid(options?: PidFileOptions): void {
    try {
      writePidFile(process.pid, options);

      // Register cleanup hooks for process exit
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
   * Remove PID file
   */
  public static removePid(options?: PidFileOptions): void {
    removePidFile(options);
  }

  /**
   * Get saved PID
   */
  public static getPid(options?: PidFileOptions): number | null {
    return readPidFile(options);
  }

  /**
   * Check if process is running
   */
  public static isRunning(options?: PidFileOptions): boolean {
    const pid = this.getPid(options);
    if (!pid) return false;

    try {
      // process.kill(pid, 0) checks if process exists without actually killing it
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if PID file exists
   */
  public static pidFileExists(options?: PidFileOptions): boolean {
    return pidFileExists(options);
  }
}
