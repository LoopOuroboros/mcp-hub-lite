import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { LogRotator } from '@utils/log-rotator.js';

// Helper function to create a complete system config with custom logging rotation
function createTestConfig(
  rotationConfig: Partial<{ rotationAge: string }> = {}
): { system: { logging: { rotationAge: string } } } {
  return {
    system: {
      logging: {
        rotationAge: rotationConfig.rotationAge ?? '7d'
      }
    }
  };
}

describe('LogRotator', () => {
  let logRotator: LogRotator;
  let tempLogDir: string;
  let originalConfig: ReturnType<typeof createTestConfig>;

  beforeEach(() => {
    // Create temporary log directory
    tempLogDir = path.join(os.tmpdir(), `log-rotator-test-${Date.now()}`);
    fs.mkdirSync(tempLogDir, { recursive: true });

    // Set default configuration
    originalConfig = createTestConfig();
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempLogDir)) {
      fs.rmSync(tempLogDir, { recursive: true, force: true });
    }

    vi.clearAllMocks();
  });

  it('should create log rotator with default base name', () => {
    logRotator = new LogRotator(tempLogDir);
    expect(logRotator).toBeDefined();
  });

  it('should create log rotator with custom base name', () => {
    logRotator = new LogRotator(tempLogDir, 'custom-log');
    expect(logRotator).toBeDefined();
  });

  it('should create log directory if it does not exist', () => {
    const newDir = path.join(tempLogDir, 'new-subdir');
    logRotator = new LogRotator(newDir);
    expect(fs.existsSync(newDir)).toBe(true);
  });

  it('should create new log file path with timestamp format', () => {
    logRotator = new LogRotator(tempLogDir, 'mcp-hub', undefined, () => originalConfig);
    const logPath = logRotator.createNewLogFilePath();

    // Should match format: mcp-hub.YYYYMMDD_HHmmSSZZZ.log
    const basename = path.basename(logPath);
    expect(basename).toMatch(/^mcp-hub\.\d{8}_\d{9}\.log$/);
  });

  it('should create different file paths on subsequent calls', () => {
    logRotator = new LogRotator(tempLogDir, 'mcp-hub', undefined, () => originalConfig);

    // Use fake timers to ensure different timestamps
    const path1 = logRotator.createNewLogFilePath();

    // Advance time by 1ms
    vi.useFakeTimers();
    vi.advanceTimersByTime(1);
    const path2 = logRotator.createNewLogFilePath();
    vi.useRealTimers();

    expect(path1).not.toBe(path2);
  });

  it('should get latest log file path', () => {
    logRotator = new LogRotator(tempLogDir, 'mcp-hub', undefined, () => originalConfig);

    // Create some log files
    const file1 = path.join(tempLogDir, 'mcp-hub.20260301_100000000.log');
    const file2 = path.join(tempLogDir, 'mcp-hub.20260301_110000000.log');
    const file3 = path.join(tempLogDir, 'mcp-hub.20260301_120000000.log');

    fs.writeFileSync(file1, 'test content');
    fs.writeFileSync(file2, 'test content');
    fs.writeFileSync(file3, 'test content');

    const latest = logRotator.getLatestLogFilePath();
    expect(latest).toBe(file3);
  });

  it('should return null for latest log file when none exist', () => {
    logRotator = new LogRotator(tempLogDir, 'mcp-hub', undefined, () => originalConfig);
    const latest = logRotator.getLatestLogFilePath();
    expect(latest).toBeNull();
  });

  it('should maintain backward compatibility with getCurrentLogFilePath', () => {
    logRotator = new LogRotator(tempLogDir, 'mcp-hub', undefined, () => originalConfig);

    // When no files exist, getCurrentLogFilePath will create a new path (but not the file)
    const path1 = logRotator.getCurrentLogFilePath();
    expect(path.basename(path1)).toMatch(/^mcp-hub\.\d{8}_\d{9}\.log$/);

    // Actually create the file on disk
    fs.writeFileSync(path1, 'test content 1');

    // Create an older file
    const oldFile = path.join(tempLogDir, 'mcp-hub.20260301_100000000.log');
    fs.writeFileSync(oldFile, 'test content 2');

    // When files exist, getCurrentLogFilePath should return the latest one
    const path2 = logRotator.getCurrentLogFilePath();
    expect(path2).toBe(path1); // Should return the newer one we just created
  });

  it('should get current log file path with custom base name', () => {
    logRotator = new LogRotator(tempLogDir, 'custom-log', undefined, () => originalConfig);
    const currentPath = logRotator.createNewLogFilePath();

    const basename = path.basename(currentPath);
    expect(basename).toMatch(/^custom-log\.\d{8}_\d{9}\.log$/);
  });

  it('should parse retention days correctly for days', () => {
    const configWithDays = createTestConfig({ rotationAge: '30d' });
    logRotator = new LogRotator(tempLogDir, 'mcp-hub', undefined, () => configWithDays);
    // @ts-expect-error - accessing private method for testing
    const retentionDays = logRotator.getRetentionDays();
    expect(retentionDays).toBe(30);
  });

  it('should parse retention days correctly for hours', () => {
    const configWithHours = createTestConfig({ rotationAge: '48h' });
    logRotator = new LogRotator(tempLogDir, 'mcp-hub', undefined, () => configWithHours);
    // @ts-expect-error - accessing private method for testing
    const retentionDays = logRotator.getRetentionDays();
    expect(retentionDays).toBe(2); // 48 hours = 2 days
  });

  it('should parse retention days correctly for minutes', () => {
    const configWithMinutes = createTestConfig({ rotationAge: '1440m' });
    logRotator = new LogRotator(tempLogDir, 'mcp-hub', undefined, () => configWithMinutes);
    // @ts-expect-error - accessing private method for testing
    const retentionDays = logRotator.getRetentionDays();
    expect(retentionDays).toBe(1); // 1440 minutes = 1 day
  });

  it('should return default retention days for invalid format', () => {
    const configWithInvalid = createTestConfig({ rotationAge: 'invalid' });
    logRotator = new LogRotator(tempLogDir, 'mcp-hub', undefined, () => configWithInvalid);
    // @ts-expect-error - accessing private method for testing
    const retentionDays = logRotator.getRetentionDays();
    expect(retentionDays).toBe(7); // default
  });

  it('should use default 7 days when no config provided', () => {
    logRotator = new LogRotator(tempLogDir, 'mcp-hub');
    // @ts-expect-error - accessing private method for testing
    const retentionDays = logRotator.getRetentionDays();
    expect(retentionDays).toBe(7); // default
  });

  it('should extract date from new format filename correctly', () => {
    logRotator = new LogRotator(tempLogDir, 'mcp-hub', undefined, () => originalConfig);
    const filename = 'mcp-hub.20251201_143022123.log';
    // @ts-expect-error - accessing private method for testing
    const date = logRotator.extractDateFromFilename(filename);

    expect(date).toBeInstanceOf(Date);
    expect(date?.getFullYear()).toBe(2025);
    expect(date?.getMonth()).toBe(11); // months are 0-indexed
    expect(date?.getDate()).toBe(1);
    expect(date?.getHours()).toBe(14);
    expect(date?.getMinutes()).toBe(30);
    expect(date?.getSeconds()).toBe(22);
    expect(date?.getMilliseconds()).toBe(123);
  });

  it('should extract date from old format filename correctly (backward compatibility)', () => {
    logRotator = new LogRotator(tempLogDir, 'mcp-hub', undefined, () => originalConfig);
    const filename = 'mcp-hub.2025-12-01.log';
    // @ts-expect-error - accessing private method for testing
    const date = logRotator.extractDateFromFilename(filename);

    expect(date).toBeInstanceOf(Date);
    expect(date?.getFullYear()).toBe(2025);
    expect(date?.getMonth()).toBe(11); // months are 0-indexed
    expect(date?.getDate()).toBe(1);
  });

  it('should return null for invalid filename', () => {
    logRotator = new LogRotator(tempLogDir, 'mcp-hub', undefined, () => originalConfig);
    const filename = 'invalid-filename.txt';
    // @ts-expect-error - accessing private method for testing
    const date = logRotator.extractDateFromFilename(filename);

    expect(date).toBeNull();
  });

  it('should get log files sorted by date (newest first)', () => {
    // Create mock log files with new format
    const newFormatDates = [
      '20260301_100000000',
      '20260301_120000000',
      '20260301_110000000'
    ];
    for (const date of newFormatDates) {
      const filePath = path.join(tempLogDir, `mcp-hub.${date}.log`);
      fs.writeFileSync(filePath, 'test content');
    }

    logRotator = new LogRotator(tempLogDir, 'mcp-hub', undefined, () => originalConfig);
    const logFiles = logRotator.getLogFiles();

    expect(logFiles).toHaveLength(3);
    // Should be sorted newest first
    expect(path.basename(logFiles[0])).toBe('mcp-hub.20260301_120000000.log');
    expect(path.basename(logFiles[1])).toBe('mcp-hub.20260301_110000000.log');
    expect(path.basename(logFiles[2])).toBe('mcp-hub.20260301_100000000.log');
  });

  it('should sort mixed format log files correctly', () => {
    // Create both old and new format files
    const oldFile = path.join(tempLogDir, 'mcp-hub.2026-02-28.log');
    const newFile1 = path.join(tempLogDir, 'mcp-hub.20260301_100000000.log');
    const newFile2 = path.join(tempLogDir, 'mcp-hub.20260301_120000000.log');

    fs.writeFileSync(oldFile, 'old format');
    fs.writeFileSync(newFile1, 'new format 1');
    fs.writeFileSync(newFile2, 'new format 2');

    logRotator = new LogRotator(tempLogDir, 'mcp-hub', undefined, () => originalConfig);
    const logFiles = logRotator.getLogFiles();

    expect(logFiles).toHaveLength(3);
    expect(path.basename(logFiles[0])).toBe('mcp-hub.20260301_120000000.log');
    expect(path.basename(logFiles[1])).toBe('mcp-hub.20260301_100000000.log');
    expect(path.basename(logFiles[2])).toBe('mcp-hub.2026-02-28.log');
  });

  it('should handle empty log directory', () => {
    logRotator = new LogRotator(tempLogDir, 'mcp-hub', undefined, () => originalConfig);
    const logFiles = logRotator.getLogFiles();

    expect(logFiles).toHaveLength(0);
  });

  it('should rotate logs and remove old files', () => {
    // Create old log files (beyond retention period)
    const oldDate = new Date('2025-01-01'); // Fixed date in the past
    const oldFilePath = path.join(tempLogDir, 'mcp-hub.20250101_100000000.log');
    fs.writeFileSync(oldFilePath, 'old log content');
    // Set file modification time to old date
    fs.utimesSync(oldFilePath, oldDate, oldDate);

    // Create recent log file (within retention period)
    const recentFilePath = path.join(tempLogDir, 'mcp-hub.20260301_100000000.log');
    fs.writeFileSync(recentFilePath, 'recent log content');

    logRotator = new LogRotator(tempLogDir, 'mcp-hub', undefined, () => originalConfig);
    logRotator.rotateLogs();

    // Old file should be deleted, recent file should remain
    expect(fs.existsSync(oldFilePath)).toBe(false);
    expect(fs.existsSync(recentFilePath)).toBe(true);
  });

  it('should handle rotation errors gracefully', () => {
    // Mock fs.readdirSync to throw an error
    const readdirSyncSpy = vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
      throw new Error('Permission denied');
    });

    logRotator = new LogRotator(tempLogDir, 'mcp-hub', undefined, () => originalConfig);

    // Should not throw an error
    expect(() => logRotator.rotateLogs()).not.toThrow();

    readdirSyncSpy.mockRestore();
  });

  it('should handle getLogFiles errors gracefully', () => {
    // Mock fs.readdirSync to throw an error
    const readdirSyncSpy = vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
      throw new Error('Permission denied');
    });

    logRotator = new LogRotator(tempLogDir, 'mcp-hub', undefined, () => originalConfig);
    const logFiles = logRotator.getLogFiles();

    expect(logFiles).toHaveLength(0);

    readdirSyncSpy.mockRestore();
  });

  describe('with custom config', () => {
    it('should create log rotator with custom configuration', () => {
      logRotator = new LogRotator(tempLogDir, 'custom-log', { rotationAge: '14d' });
      expect(logRotator).toBeDefined();
    });

    it('should use custom rotation age when provided', () => {
      logRotator = new LogRotator(tempLogDir, 'custom-log', { rotationAge: '30d' });
      // @ts-expect-error - accessing private method for testing
      const retentionDays = logRotator.getRetentionDays();
      expect(retentionDays).toBe(30);
    });

    it('should parse custom rotation age in hours', () => {
      logRotator = new LogRotator(tempLogDir, 'custom-log', { rotationAge: '48h' });
      // @ts-expect-error - accessing private method for testing
      const retentionDays = logRotator.getRetentionDays();
      expect(retentionDays).toBe(2);
    });

    it('should parse custom rotation age in minutes', () => {
      logRotator = new LogRotator(tempLogDir, 'custom-log', { rotationAge: '2880m' });
      // @ts-expect-error - accessing private method for testing
      const retentionDays = logRotator.getRetentionDays();
      expect(retentionDays).toBe(2); // 2880 minutes = 2 days
    });

    it('should return default 7 days for invalid custom format', () => {
      logRotator = new LogRotator(tempLogDir, 'custom-log', { rotationAge: 'invalid' });
      // @ts-expect-error - accessing private method for testing
      const retentionDays = logRotator.getRetentionDays();
      expect(retentionDays).toBe(7);
    });

    it('should use default 7 days when no custom rotation age provided', () => {
      logRotator = new LogRotator(tempLogDir, 'custom-log', {});
      // @ts-expect-error - accessing private method for testing
      const retentionDays = logRotator.getRetentionDays();
      expect(retentionDays).toBe(7);
    });

    it('should create new log file path with custom base name and custom config', () => {
      logRotator = new LogRotator(tempLogDir, 'dev-server', { rotationAge: '7d' });
      const logPath = logRotator.createNewLogFilePath();

      const basename = path.basename(logPath);
      expect(basename).toMatch(/^dev-server\.\d{8}_\d{9}\.log$/);
    });

    it('should rotate logs with custom retention period', () => {
      // Create old log files (beyond custom 2-day retention period)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 3); // 3 days old
      const oldFilePath = path.join(tempLogDir, 'dev-server.20260228_100000000.log');
      fs.writeFileSync(oldFilePath, 'old log content');
      fs.utimesSync(oldFilePath, oldDate, oldDate);

      // Create recent log file (within custom 2-day retention period)
      const recentFilePath = path.join(tempLogDir, 'dev-server.20260301_100000000.log');
      fs.writeFileSync(recentFilePath, 'recent log content');

      logRotator = new LogRotator(tempLogDir, 'dev-server', { rotationAge: '2d' });
      logRotator.rotateLogs();

      // Old file should be deleted, recent file should remain
      expect(fs.existsSync(oldFilePath)).toBe(false);
      expect(fs.existsSync(recentFilePath)).toBe(true);
    });
  });
});
