import * as fs from 'fs';
import * as path from 'path';
import { configManager } from '@config/config-manager.js';

/**
 * Log Rotator for MCP Hub Lite
 * Handles daily log rotation and cleanup of old log files
 */
export class LogRotator {
  private logDir: string;
  private logBaseName: string;
  private config: ReturnType<typeof configManager.getConfig>;

  constructor(logDir: string, logBaseName: string = 'mcp-hub') {
    this.logDir = logDir;
    this.logBaseName = logBaseName;
    this.config = configManager.getConfig();

    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getRetentionDays(): number {
    const maxAge = this.config.system.logging.rotationAge;
    // Parse maxAge like "7d", "30d", etc.
    const match = maxAge.match(/^(\d+)([dhm])$/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      switch (unit) {
        case 'd':
          return value;
        case 'h':
          return Math.ceil(value / 24);
        case 'm':
          return Math.ceil(value / (24 * 60));
        default:
          return 7;
      }
    }
    return 7; // default to 7 days
  }

  /**
   * Get the current log file path based on today's date
   */
  public getCurrentLogFilePath(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    return path.join(this.logDir, `${this.logBaseName}.${dateString}.log`);
  }

  /**
   * Rotate logs by cleaning up old log files beyond retention period
   */
  public rotateLogs(): void {
    try {
      const files = fs.readdirSync(this.logDir);
      const logFiles = files.filter(
        (file) => file.startsWith(`${this.logBaseName}.`) && file.endsWith('.log')
      );

      const now = new Date();
      const retentionThreshold = new Date();
      retentionThreshold.setDate(now.getDate() - this.getRetentionDays());

      for (const file of logFiles) {
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime < retentionThreshold) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      console.error('Failed to rotate logs:', error);
    }
  }

  /**
   * Get all existing log files sorted by date (newest first)
   */
  public getLogFiles(): string[] {
    try {
      const files = fs.readdirSync(this.logDir);
      const logFiles = files
        .filter((file) => file.startsWith(`${this.logBaseName}.`) && file.endsWith('.log'))
        .map((file) => ({
          name: file,
          path: path.join(this.logDir, file),
          date: this.extractDateFromFilename(file)
        }))
        .filter((item) => item.date !== null)
        .sort((a, b) => (b.date as Date).getTime() - (a.date as Date).getTime())
        .map((item) => item.path);

      return logFiles;
    } catch (error) {
      console.error('Failed to get log files:', error);
      return [];
    }
  }

  /**
   * Extract date from log filename
   */
  private extractDateFromFilename(filename: string): Date | null {
    const match = filename.match(new RegExp(`${this.logBaseName}\\.(\\d{4}-\\d{2}-\\d{2})\\.log$`));
    if (match && match[1]) {
      return new Date(match[1]);
    }
    return null;
  }
}
