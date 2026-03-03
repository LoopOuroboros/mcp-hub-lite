/**
 * Development mode logging setup.
 * This file contains development log initialization and management.
 */

import fs from 'fs';
import path from 'path';
import { LogRotator, type RotatorConfig } from '../log-rotator.js';

/**
 * Development logger configuration and setup.
 */
export class DevLogger {
  private logFileStream: fs.WriteStream | null = null;
  private devLogRotator: LogRotator | null = null;

  /**
   * Get the current log file stream.
   */
  get stream(): fs.WriteStream | null {
    return this.logFileStream;
  }

  /**
   * Get the dev log rotator (for testing only).
   * @internal
   */
  get rotator(): LogRotator | null {
    return this.devLogRotator;
  }

  /**
   * Enables development logging mode with file output and enhanced debugging.
   *
   * This method configures the logger to:
   * - Write all log output to a file in the logs/ directory
   * - Use timestamp-based log file naming (dev-server.YYYYMMDD_HHmmSSZZZ.log)
   * - Automatically clean up old log files (default: 7 days retention)
   *
   * @param rotatorConfig - Optional custom rotation configuration (default: 7 days retention)
   * @param onLogEnabled - Optional callback when log is enabled, receives the log file path
   */
  enableDevLog(rotatorConfig?: RotatorConfig, onLogEnabled?: (logFilePath: string) => void): void {
    if (this.logFileStream) return;

    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const config: RotatorConfig = rotatorConfig || { rotationAge: '7d' };
    this.devLogRotator = new LogRotator(logDir, 'dev-server', config);
    this.devLogRotator.rotateLogs();

    const logFile = this.devLogRotator.createNewLogFilePath();
    this.logFileStream = fs.createWriteStream(logFile, { flags: 'a' });

    if (onLogEnabled) {
      onLogEnabled(logFile);
    }
  }

  /**
   * Close the dev log file stream if open.
   */
  close(): void {
    if (this.logFileStream) {
      this.logFileStream.end();
      this.logFileStream = null;
    }
  }
}
