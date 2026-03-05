import * as fs from 'fs';
import * as path from 'path';

/**
 * Configuration interface for custom log rotation settings.
 */
export interface RotatorConfig {
  rotationAge?: string;
}

/**
 * Type for the config getter function to avoid direct import dependency.
 */
type ConfigGetter = () => { system: { logging: { rotationAge: string } } };

/**
 * Manages log file rotation and cleanup for MCP Hub Lite.
 *
 * This class provides automated log rotation functionality that creates log files
 * with timestamp-based naming on each startup and automatically cleans up old log files
 * based on the configured retention period. It ensures that log storage doesn't grow
 * indefinitely while maintaining a configurable history of log files for debugging
 * and monitoring purposes.
 *
 * The log rotator works by:
 * 1. Creating log files with format: `{logBaseName}.{YYYYMMDD_HHmmSSZZZ}.log` on each startup
 * 2. Automatically cleaning up log files older than the configured retention period
 * 3. Providing utilities to retrieve and manage existing log files
 *
 * @example
 * ```typescript
 * const logDir = path.join(os.homedir(), '.mcp-hub-lite', 'logs');
 * const rotator = new LogRotator(logDir, 'mcp-hub');
 *
 * // Create a new log file with timestamp (for startup)
 * const newLogPath = rotator.createNewLogFilePath();
 *
 * // Get the latest existing log file
 * const latestLogPath = rotator.getLatestLogFilePath();
 *
 * // Perform log rotation (cleanup old files)
 * rotator.rotateLogs();
 *
 * // Get all log files sorted by date (newest first)
 * const logFiles = rotator.getLogFiles();
 * ```
 *
 * @example
 * ```typescript
 * // With custom configuration (independent from global config)
 * const rotator = new LogRotator(logDir, 'dev-server', { rotationAge: '7d' });
 * ```
 *
 * @class
 * @since 1.0.0
 */
export class LogRotator {
  private logDir: string;
  private logBaseName: string;
  private customConfig: RotatorConfig | null;
  private configGetter: ConfigGetter | null;

  /**
   * Creates a new LogRotator instance.
   *
   * @param logDir - The directory where log files are stored
   * @param logBaseName - The base name for log files (default: 'mcp-hub')
   * @param customConfig - Optional custom configuration for independent rotation settings
   * @param configGetter - Optional config getter function for global config access (for backward compatibility)
   */
  constructor(
    logDir: string,
    logBaseName: string = 'mcp-hub',
    customConfig?: RotatorConfig,
    configGetter?: ConfigGetter
  ) {
    this.logDir = logDir;
    this.logBaseName = logBaseName;
    this.customConfig = customConfig || null;
    this.configGetter = configGetter || null;

    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Calculates the retention period in days from the configured rotation age.
   *
   * Parses the rotation age configuration value which can be in
   * various formats (e.g., "7d", "24h", "1440m") and converts it to days.
   * Hours and minutes are converted to days using ceiling division to ensure
   * proper retention behavior.
   *
   * If a customConfig was provided, it will be used; otherwise, falls back to
   * the configGetter if provided; defaults to 7 days.
   *
   * @returns {number} The retention period in days. Defaults to 7 days if the
   *                   configuration is invalid or cannot be parsed.
   * @private
   */
  private getRetentionDays(): number {
    const maxAge =
      this.customConfig?.rotationAge ??
      (this.configGetter ? this.configGetter().system.logging.rotationAge : null) ??
      '7d';
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
   * Generates a timestamp string in YYYYMMDD_HHmmSSZZZ format.
   *
   * @param date - The date to format, defaults to current date/time
   * @returns {string} Formatted timestamp string
   * @private
   */
  private formatTimestamp(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    return `${year}${month}${day}_${hours}${minutes}${seconds}${milliseconds}`;
  }

  /**
   * Creates a new log file path with the current timestamp.
   *
   * This method generates a log file path using the configured log directory and base name,
   * combined with the current timestamp in YYYYMMDD_HHmmSSZZZ format. The resulting path
   * follows the pattern: `{logDir}/{logBaseName}.{YYYYMMDD_HHmmSSZZZ}.log`
   *
   * This method should be called on application startup to create a new log file
   * for each session.
   *
   * @returns {string} The absolute file path for the new log file.
   * @example
   * ```typescript
   * const rotator = new LogRotator('/var/log/mcp-hub', 'mcp-hub');
   * const logPath = rotator.createNewLogFilePath();
   * // Returns: '/var/log/mcp-hub/mcp-hub.20260301_143022123.log' (with current timestamp)
   * ```
   */
  public createNewLogFilePath(): string {
    const timestamp = this.formatTimestamp();
    return path.join(this.logDir, `${this.logBaseName}.${timestamp}.log`);
  }

  /**
   * Gets the latest existing log file path.
   *
   * This method scans the log directory and returns the path to the most recent
   * log file based on the timestamp in the filename. If no log files exist,
   * it returns null.
   *
   * @returns {string | null} The absolute file path to the latest log file, or null if none exist.
   * @example
   * ```typescript
   * const rotator = new LogRotator('/var/log/mcp-hub', 'mcp-hub');
   * const latestLog = rotator.getLatestLogFilePath();
   * // Returns: '/var/log/mcp-hub/mcp-hub.20260301_143022123.log' or null
   * ```
   */
  public getLatestLogFilePath(): string | null {
    const logFiles = this.getLogFiles();
    return logFiles.length > 0 ? logFiles[0] : null;
  }

  /**
   * Gets the current log file path (backward compatibility).
   *
   * This method is maintained for backward compatibility. It first tries to get
   * the latest existing log file. If none exists, it creates a new one.
   *
   * @returns {string} The absolute file path for the current log file.
   * @deprecated Use createNewLogFilePath() or getLatestLogFilePath() instead
   * @example
   * ```typescript
   * const rotator = new LogRotator('/var/log/mcp-hub', 'mcp-hub');
   * const logPath = rotator.getCurrentLogFilePath();
   * ```
   */
  public getCurrentLogFilePath(): string {
    const latest = this.getLatestLogFilePath();
    return latest ?? this.createNewLogFilePath();
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
   * Parses filenames that match either:
   * - New format: `{logBaseName}.{YYYYMMDD_HHmmSSZZZ}.log` (preferred)
   * - Old format: `{logBaseName}.{YYYY-MM-DD}.log` (for backward compatibility)
   *
   * and extracts the date portion, converting it to a Date object.
   *
   * @param {string} filename - The log filename to parse
   *                             (e.g., "mcp-hub.20260301_143022123.log" or "mcp-hub.2026-02-16.log")
   * @returns {Date | null} A Date object representing the extracted date, or null
   *                        if the filename doesn't match the expected pattern or
   *                        contains an invalid date.
   * @private
   */
  private extractDateFromFilename(filename: string): Date | null {
    // Try new format first: YYYYMMDD_HHmmSSZZZ
    const newFormatMatch = filename.match(
      new RegExp(
        `${this.logBaseName}\\.(\\d{4})(\\d{2})(\\d{2})_(\\d{2})(\\d{2})(\\d{2})(\\d{3})\\.log$`
      )
    );
    if (newFormatMatch) {
      const [, year, month, day, hours, minutes, seconds, ms] = newFormatMatch;
      return new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1, // months are 0-indexed
        parseInt(day, 10),
        parseInt(hours, 10),
        parseInt(minutes, 10),
        parseInt(seconds, 10),
        parseInt(ms, 10)
      );
    }

    // Try old format: YYYY-MM-DD (backward compatibility)
    const oldFormatMatch = filename.match(
      new RegExp(`${this.logBaseName}\\.(\\d{4}-\\d{2}-\\d{2})\\.log$`)
    );
    if (oldFormatMatch && oldFormatMatch[1]) {
      return new Date(oldFormatMatch[1]);
    }

    return null;
  }
}
