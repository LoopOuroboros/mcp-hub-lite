/**
 * PID Manager for MCP Hub Lite service lifecycle management.
 *
 * This class provides a centralized interface for managing process ID (PID) files
 * that track the running state of the MCP Hub Lite service. It handles writing,
 * reading, and cleaning up PID files, as well as registering appropriate signal
 * handlers to ensure proper cleanup during process termination.
 *
 * The PID manager is primarily used by the CLI entry point and server runner
 * to maintain service state awareness and prevent multiple instances from
 * running simultaneously.
 *
 * @example
 * // Write PID file at service startup
 * PidManager.writePid();
 *
 * // Check if service is already running
 * if (PidManager.isRunning()) {
 *   console.log('Service is already running');
 *   process.exit(1);
 * }
 *
 * // Clean up PID file on shutdown
 * PidManager.removePid();
 */
import { logger } from '@utils/logger.js';
import { LOG_MODULES } from '@utils/logger/log-modules.js';
import { writePidFile, readPidFile, removePidFile, pidFileExists } from './file.js';
import type { PidFileOptions } from './types.js';

export class PidManager {
  /**
   * Writes the current process PID to a PID file and registers cleanup hooks
   * for graceful shutdown handling.
   *
   * This method should be called during service startup to create a PID file
   * that tracks the running process. It automatically registers signal handlers
   * for SIGINT, SIGTERM, and process exit events to ensure the PID file is
   * properly cleaned up when the process terminates.
   *
   * @param options - Optional configuration for PID file location and behavior
   * @throws Will log an error if PID file writing fails, but will not throw
   *
   * @example
   * // Basic usage with default PID file location
   * PidManager.writePid();
   *
   * // Custom PID file location
   * PidManager.writePid({ pidFilePath: '/custom/path/mcp-hub.pid' });
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
      logger.error('Failed to write PID file:', error, LOG_MODULES.PID_MANAGER);
    }
  }

  /**
   * Removes the PID file from the filesystem.
   *
   * This method safely deletes the PID file, typically called during service
   * shutdown or cleanup operations. It's automatically invoked by the signal
   * handlers registered in `writePid()`.
   *
   * @param options - Optional configuration matching the options used when
   * writing the PID file
   *
   * @example
   * // Remove PID file with default options
   * PidManager.removePid();
   *
   * // Remove PID file with custom path
   * PidManager.removePid({ pidFilePath: '/custom/path/mcp-hub.pid' });
   */
  public static removePid(options?: PidFileOptions): void {
    removePidFile(options);
  }

  /**
   * Retrieves the PID stored in the PID file.
   *
   * Reads the PID file and returns the stored process ID if it exists and
   * contains valid data. Returns null if the file doesn't exist, is empty,
   * or contains invalid data.
   *
   * @param options - Optional configuration for PID file location
   * @returns The stored process ID as a number, or null if no valid PID is found
   *
   * @example
   * const pid = PidManager.getPid();
   * if (pid) {
   *   console.log(`Service is running with PID: ${pid}`);
   * }
   */
  public static getPid(options?: PidFileOptions): number | null {
    return readPidFile(options);
  }

  /**
   * Checks whether the process associated with the stored PID is currently running.
   *
   * This method first retrieves the PID from the PID file, then uses the
   * `process.kill(pid, 0)` system call to verify if a process with that PID
   * is still active. This is a safe operation that only checks process existence
   * without sending any actual signal to terminate the process.
   *
   * @param options - Optional configuration for PID file location
   * @returns true if a process with the stored PID is running, false otherwise
   *
   * @example
   * if (PidManager.isRunning()) {
   *   console.log('MCP Hub Lite service is already running');
   *   process.exit(1);
   * }
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
   * Checks whether the PID file exists on the filesystem.
   *
   * This method verifies the existence of the PID file without attempting to
   * read its contents or validate the stored PID. It's useful for determining
   * if a previous instance may have created a PID file, regardless of whether
   * that process is still running.
   *
   * @param options - Optional configuration for PID file location
   * @returns true if the PID file exists, false otherwise
   *
   * @example
   * if (PidManager.pidFileExists()) {
   *   console.log('PID file exists, checking if process is running...');
   *   if (!PidManager.isRunning()) {
   *     console.log('Stale PID file detected, cleaning up...');
   *     PidManager.removePid();
   *   }
   * }
   */
  public static pidFileExists(options?: PidFileOptions): boolean {
    return pidFileExists(options);
  }
}
