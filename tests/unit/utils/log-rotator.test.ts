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

  it("should get current log file path with today's date", () => {
    logRotator = new LogRotator(tempLogDir, 'mcp-hub', undefined, () => originalConfig);
    const currentPath = logRotator.getCurrentLogFilePath();

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const expectedPath = path.join(tempLogDir, `mcp-hub.${year}-${month}-${day}.log`);

    expect(currentPath).toBe(expectedPath);
  });

  it('should get current log file path with custom base name', () => {
    logRotator = new LogRotator(tempLogDir, 'custom-log', undefined, () => originalConfig);
    const currentPath = logRotator.getCurrentLogFilePath();

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const expectedPath = path.join(tempLogDir, `custom-log.${year}-${month}-${day}.log`);

    expect(currentPath).toBe(expectedPath);
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

  it('should extract date from filename correctly', () => {
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
    // Create mock log files
    const dates = ['2025-12-01', '2025-12-03', '2025-12-02'];
    for (const date of dates) {
      const filePath = path.join(tempLogDir, `mcp-hub.${date}.log`);
      fs.writeFileSync(filePath, 'test content');
    }

    logRotator = new LogRotator(tempLogDir, 'mcp-hub', undefined, () => originalConfig);
    const logFiles = logRotator.getLogFiles();

    expect(logFiles).toHaveLength(3);
    // Should be sorted newest first: 2025-12-03, 2025-12-02, 2025-12-01
    expect(path.basename(logFiles[0])).toBe('mcp-hub.2025-12-03.log');
    expect(path.basename(logFiles[1])).toBe('mcp-hub.2025-12-02.log');
    expect(path.basename(logFiles[2])).toBe('mcp-hub.2025-12-01.log');
  });

  it('should handle empty log directory', () => {
    logRotator = new LogRotator(tempLogDir, 'mcp-hub', undefined, () => originalConfig);
    const logFiles = logRotator.getLogFiles();

    expect(logFiles).toHaveLength(0);
  });

  it('should rotate logs and remove old files', () => {
    // Create old log files (beyond retention period)
    const oldDate = new Date('2025-01-01'); // Fixed date in the past
    const oldDateString = `${oldDate.getFullYear()}-${String(oldDate.getMonth() + 1).padStart(2, '0')}-${String(oldDate.getDate()).padStart(2, '0')}`;
    const oldFilePath = path.join(tempLogDir, `mcp-hub.${oldDateString}.log`);
    fs.writeFileSync(oldFilePath, 'old log content');
    // Set file modification time to old date
    fs.utimesSync(oldFilePath, oldDate, oldDate);

    // Create recent log file (within retention period)
    const recentDate = new Date(); // Current date
    const recentDateString = `${recentDate.getFullYear()}-${String(recentDate.getMonth() + 1).padStart(2, '0')}-${String(recentDate.getDate()).padStart(2, '0')}`;
    const recentFilePath = path.join(tempLogDir, `mcp-hub.${recentDateString}.log`);
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

    it('should get current log file path with custom base name and custom config', () => {
      logRotator = new LogRotator(tempLogDir, 'dev-server', { rotationAge: '7d' });
      const currentPath = logRotator.getCurrentLogFilePath();

      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const expectedPath = path.join(tempLogDir, `dev-server.${year}-${month}-${day}.log`);

      expect(currentPath).toBe(expectedPath);
    });

    it('should rotate logs with custom retention period', () => {
      // Create old log files (beyond custom 2-day retention period)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 3); // 3 days old
      const oldDateString = `${oldDate.getFullYear()}-${String(oldDate.getMonth() + 1).padStart(2, '0')}-${String(oldDate.getDate()).padStart(2, '0')}`;
      const oldFilePath = path.join(tempLogDir, `dev-server.${oldDateString}.log`);
      fs.writeFileSync(oldFilePath, 'old log content');
      fs.utimesSync(oldFilePath, oldDate, oldDate);

      // Create recent log file (within custom 2-day retention period)
      const recentDate = new Date();
      const recentDateString = `${recentDate.getFullYear()}-${String(recentDate.getMonth() + 1).padStart(2, '0')}-${String(recentDate.getDate()).padStart(2, '0')}`;
      const recentFilePath = path.join(tempLogDir, `dev-server.${recentDateString}.log`);
      fs.writeFileSync(recentFilePath, 'recent log content');

      logRotator = new LogRotator(tempLogDir, 'dev-server', { rotationAge: '2d' });
      logRotator.rotateLogs();

      // Old file should be deleted, recent file should remain
      expect(fs.existsSync(oldFilePath)).toBe(false);
      expect(fs.existsSync(recentFilePath)).toBe(true);
    });
  });
});
