import * as fs from 'fs';
import * as path from 'path';
import { configManager } from '@config/config-manager.js';

/**
 * Manages log file rotation and cleanup for MCP Hub Lite.
 *
 * This class provides automated log rotation functionality that creates daily log files
 * with date-based naming and automatically cleans up old log files based on the configured
 * retention period. It ensures that log storage doesn't grow indefinitely while maintaining
 * a configurable history of log files for debugging and monitoring purposes.
 *
 * The log rotator works by:
 * 1. Creating log files with format: `{logBaseName}.{YYYY-MM-DD}.log`
 * 2. Automatically cleaning up log files older than the configured retention period
 * 3. Providing utilities to retrieve and manage existing log files
 *
 * @example
 * ```typescript
 * const logDir = path.join(os.homedir(), '.mcp-hub-lite', 'logs');
 * const rotator = new LogRotator(logDir, 'mcp-hub');
 *
 * // Get current log file path for today
 * const currentLogPath = rotator.getCurrentLogFilePath();
 *
 * // Perform log rotation (cleanup old files)
 * rotator.rotateLogs();
 *
 * // Get all log files sorted by date (newest first)
 * const logFiles = rotator.getLogFiles();
 * ```
 *
 * @class
 * @since 1.0.0
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

  /**
   * Calculates the retention period in days from the configured rotation age.
   *
   * Parses the `system.logging.rotationAge` configuration value which can be in
   * various formats (e.g., "7d", "24h", "1440m") and converts it to days.
   * Hours and minutes are converted to days using ceiling division to ensure
   * proper retention behavior.
   *
   * @returns {number} The retention period in days. Defaults to 7 days if the
   *                   configuration is invalid or cannot be parsed.
   * @private
   */
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
   * Gets the current log file path for today's date.
   *
   * This method generates a log file path using the configured log directory and base name,
   * combined with today's date in YYYY-MM-DD format. The resulting path follows the pattern:
   * `{logDir}/{logBaseName}.{YYYY-MM-DD}.log`
   *
   * This method is typically used by the logging system to determine which log file
   * should receive new log entries for the current day.
   *
   * @returns {string} The absolute file path for today's log file.
   * @example
   * ```typescript
   * const rotator = new LogRotator('/var/log/mcp-hub', 'mcp-hub');
   * const logPath = rotator.getCurrentLogFilePath();
   * // Returns: '/var/log/mcp-hub/mcp-hub.2026-02-16.log' (for today's date)
   * ```
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
   * Performs log rotation by cleaning up old log files beyond the retention period.
   *
   * This method scans the configured log directory for files matching the pattern
   * `{logBaseName}.{YYYY-MM-DD}.log` and removes any files that are older than
   * the configured retention period (specified in the system configuration under
   * `system.logging.rotationAge`).
   *
   * The retention period supports various time units:
   * - 'd' for days (e.g., "7d" = 7 days)
   * - 'h' for hours (e.g., "24h" = 1 day)
   * - 'm' for minutes (e.g., "1440m" = 1 day)
   *
   * If no valid retention period is configured, it defaults to 7 days.
   *
   * This method should be called periodically (e.g., on application startup or
   * via a scheduled task) to prevent log files from consuming excessive disk space.
   *
   * @returns {void}
   * @throws {Error} If there's an error reading the log directory or deleting files,
   *                 the error is caught and logged to console.error, but the method
   *                 continues execution without throwing.
   * @example
   * ```typescript
   * const rotator = new LogRotator('/var/log/mcp-hub', 'mcp-hub');
   * rotator.rotateLogs(); // Cleans up log files older than configured retention period
   * ```
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
   * Retrieves all existing log files sorted by date (newest first).
   *
   * This method scans the configured log directory for files matching the pattern
   * `{logBaseName}.{YYYY-MM-DD}.log`, extracts the date from each filename,
   * and returns an array of absolute file paths sorted in descending order by date
   * (newest files first).
   *
   * This is useful for log management interfaces, log viewing utilities, or any
   * functionality that needs to present log files in chronological order.
   *
   * @returns {string[]} Array of absolute file paths to log files, sorted by date
   *                     with newest files first. Returns an empty array if no log
   *                     files are found or if an error occurs during scanning.
   * @throws {Error} If there's an error reading the log directory, the error is
   *                 caught and logged to console.error, but the method returns
   *                 an empty array instead of throwing.
   * @example
   * ```typescript
   * const rotator = new LogRotator('/var/log/mcp-hub', 'mcp-hub');
   * const logFiles = rotator.getLogFiles();
   * // Returns: [
   * //   '/var/log/mcp-hub/mcp-hub.2026-02-16.log',
   * //   '/var/log/mcp-hub/mcp-hub.2026-02-15.log',
   * //   '/var/log/mcp-hub/mcp-hub.2026-02-14.log'
   * // ]
   * ```
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
   * Extracts the date from a log filename.
   *
   * Parses filenames that match the pattern `{logBaseName}.{YYYY-MM-DD}.log`
   * and extracts the date portion, converting it to a Date object.
   *
   * @param {string} filename - The log filename to parse (e.g., "mcp-hub.2026-02-16.log")
   * @returns {Date | null} A Date object representing the extracted date, or null
   *                        if the filename doesn't match the expected pattern or
   *                        contains an invalid date.
   * @private
   */
  private extractDateFromFilename(filename: string): Date | null {
    const match = filename.match(new RegExp(`${this.logBaseName}\\.(\\d{4}-\\d{2}-\\d{2})\\.log$`));
    if (match && match[1]) {
      return new Date(match[1]);
    }
    return null;
  }
}
