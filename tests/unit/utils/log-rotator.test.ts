import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { LogRotator } from '@utils/log-rotator.js';
import { configManager } from '@config/config-manager.js';

// Mock configManager
vi.mock('@config/config-manager.js', () => ({
  configManager: {
    getConfig: vi.fn()
  }
}));

describe('LogRotator', () => {
  let logRotator: LogRotator;
  let tempLogDir: string;
  let originalConfig: any;

  beforeEach(() => {
    // 创建临时日志目录
    tempLogDir = path.join(os.tmpdir(), `log-rotator-test-${Date.now()}`);
    fs.mkdirSync(tempLogDir, { recursive: true });

    // 设置默认配置
    originalConfig = {
      system: {
        logging: {
          rotation: {
            enabled: true,
            maxAge: '7d'
          }
        }
      }
    };

    (configManager.getConfig as any).mockReturnValue(originalConfig);
  });

  afterEach(() => {
    // 清理临时目录
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

  it('should get current log file path with today\'s date', () => {
    logRotator = new LogRotator(tempLogDir);
    const currentPath = logRotator.getCurrentLogFilePath();

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const expectedPath = path.join(tempLogDir, `mcp-hub.${year}-${month}-${day}.log`);

    expect(currentPath).toBe(expectedPath);
  });

  it('should get current log file path with custom base name', () => {
    logRotator = new LogRotator(tempLogDir, 'custom-log');
    const currentPath = logRotator.getCurrentLogFilePath();

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const expectedPath = path.join(tempLogDir, `custom-log.${year}-${month}-${day}.log`);

    expect(currentPath).toBe(expectedPath);
  });

  it('should parse retention days correctly for days', () => {
    const configWithDays = {
      system: {
        logging: {
          rotation: {
            enabled: true,
            maxAge: '30d'
          }
        }
      }
    };
    (configManager.getConfig as any).mockReturnValue(configWithDays);

    logRotator = new LogRotator(tempLogDir);
    const retentionDays = (logRotator as any).getRetentionDays();
    expect(retentionDays).toBe(30);
  });

  it('should parse retention days correctly for hours', () => {
    const configWithHours = {
      system: {
        logging: {
          rotation: {
            enabled: true,
            maxAge: '48h'
          }
        }
      }
    };
    (configManager.getConfig as any).mockReturnValue(configWithHours);

    logRotator = new LogRotator(tempLogDir);
    const retentionDays = (logRotator as any).getRetentionDays();
    expect(retentionDays).toBe(2); // 48 hours = 2 days
  });

  it('should parse retention days correctly for minutes', () => {
    const configWithMinutes = {
      system: {
        logging: {
          rotation: {
            enabled: true,
            maxAge: '1440m' // 24 hours
          }
        }
      }
    };
    (configManager.getConfig as any).mockReturnValue(configWithMinutes);

    logRotator = new LogRotator(tempLogDir);
    const retentionDays = (logRotator as any).getRetentionDays();
    expect(retentionDays).toBe(1); // 1440 minutes = 1 day
  });

  it('should return default retention days for invalid format', () => {
    const configWithInvalid = {
      system: {
        logging: {
          rotation: {
            enabled: true,
            maxAge: 'invalid'
          }
        }
      }
    };
    (configManager.getConfig as any).mockReturnValue(configWithInvalid);

    logRotator = new LogRotator(tempLogDir);
    const retentionDays = (logRotator as any).getRetentionDays();
    expect(retentionDays).toBe(7); // default
  });

  it('should check if rotation is enabled', () => {
    const configEnabled = {
      system: {
        logging: {
          rotation: {
            enabled: true,
            maxAge: '7d'
          }
        }
      }
    };
    (configManager.getConfig as any).mockReturnValue(configEnabled);

    logRotator = new LogRotator(tempLogDir);
    expect((logRotator as any).isRotationEnabled()).toBe(true);
  });

  it('should check if rotation is disabled', () => {
    const configDisabled = {
      system: {
        logging: {
          rotation: {
            enabled: false,
            maxAge: '7d'
          }
        }
      }
    };
    (configManager.getConfig as any).mockReturnValue(configDisabled);

    logRotator = new LogRotator(tempLogDir);
    expect((logRotator as any).isRotationEnabled()).toBe(false);
  });

  it('should extract date from filename correctly', () => {
    logRotator = new LogRotator(tempLogDir);
    const filename = 'mcp-hub.2025-12-01.log';
    const date = (logRotator as any).extractDateFromFilename(filename);

    expect(date).toBeInstanceOf(Date);
    expect(date?.getFullYear()).toBe(2025);
    expect(date?.getMonth()).toBe(11); // months are 0-indexed
    expect(date?.getDate()).toBe(1);
  });

  it('should return null for invalid filename', () => {
    logRotator = new LogRotator(tempLogDir);
    const filename = 'invalid-filename.txt';
    const date = (logRotator as any).extractDateFromFilename(filename);

    expect(date).toBeNull();
  });

  it('should get log files sorted by date (newest first)', () => {
    // Create mock log files
    const dates = ['2025-12-01', '2025-12-03', '2025-12-02'];
    for (const date of dates) {
      const filePath = path.join(tempLogDir, `mcp-hub.${date}.log`);
      fs.writeFileSync(filePath, 'test content');
    }

    logRotator = new LogRotator(tempLogDir);
    const logFiles = logRotator.getLogFiles();

    expect(logFiles).toHaveLength(3);
    // Should be sorted newest first: 2025-12-03, 2025-12-02, 2025-12-01
    expect(path.basename(logFiles[0])).toBe('mcp-hub.2025-12-03.log');
    expect(path.basename(logFiles[1])).toBe('mcp-hub.2025-12-02.log');
    expect(path.basename(logFiles[2])).toBe('mcp-hub.2025-12-01.log');
  });

  it('should handle empty log directory', () => {
    logRotator = new LogRotator(tempLogDir);
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

    logRotator = new LogRotator(tempLogDir);
    logRotator.rotateLogs();

    // Old file should be deleted, recent file should remain
    expect(fs.existsSync(oldFilePath)).toBe(false);
    expect(fs.existsSync(recentFilePath)).toBe(true);
  });

  it('should not rotate logs when disabled', () => {
    const configDisabled = {
      system: {
        logging: {
          rotation: {
            enabled: false,
            maxAge: '7d'
          }
        }
      }
    };
    (configManager.getConfig as any).mockReturnValue(configDisabled);

    // Create old log file
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);
    const oldDateString = `${oldDate.getFullYear()}-${String(oldDate.getMonth() + 1).padStart(2, '0')}-${String(oldDate.getDate()).padStart(2, '0')}`;
    const oldFilePath = path.join(tempLogDir, `mcp-hub.${oldDateString}.log`);
    fs.writeFileSync(oldFilePath, 'old log content');

    logRotator = new LogRotator(tempLogDir);
    logRotator.rotateLogs();

    // File should still exist since rotation is disabled
    expect(fs.existsSync(oldFilePath)).toBe(true);
  });

  it('should handle rotation errors gracefully', () => {
    // Mock fs.readdirSync to throw an error
    const readdirSyncSpy = vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
      throw new Error('Permission denied');
    });

    logRotator = new LogRotator(tempLogDir);

    // Should not throw an error
    expect(() => logRotator.rotateLogs()).not.toThrow();

    readdirSyncSpy.mockRestore();
  });

  it('should handle getLogFiles errors gracefully', () => {
    // Mock fs.readdirSync to throw an error
    const readdirSyncSpy = vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
      throw new Error('Permission denied');
    });

    logRotator = new LogRotator(tempLogDir);
    const logFiles = logRotator.getLogFiles();

    expect(logFiles).toHaveLength(0);

    readdirSyncSpy.mockRestore();
  });
});