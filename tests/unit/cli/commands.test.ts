import { describe, it, expect } from 'vitest';
import { startCommand } from '@cli/commands/start.js';
import { stopCommand } from '@cli/commands/stop.js';
import { statusCommand } from '@cli/commands/status.js';
import { uiCommand } from '@cli/commands/ui.js';
import { listCommand } from '@cli/commands/list.js';
import { restartCommand } from '@cli/commands/restart.js';

describe('CLI Commands Options', () => {
  describe('Start Command', () => {
    it('should be defined', () => {
      expect(startCommand).toBeDefined();
    });

    it('should have port option without hardcoded default (reads from config)', () => {
      const portOption = startCommand.options.find((opt) => opt.long === '--port');
      expect(portOption).toBeDefined();
      expect(portOption?.defaultValue).toBeUndefined();
    });

    it('should have host option without hardcoded default (reads from config)', () => {
      const hostOption = startCommand.options.find((opt) => opt.long === '--host');
      expect(hostOption).toBeDefined();
      expect(hostOption?.defaultValue).toBeUndefined();
    });

    it('should have foreground option', () => {
      const foregroundOption = startCommand.options.find((opt) => opt.long === '--foreground');
      expect(foregroundOption).toBeDefined();
    });

    it('should have stdio option', () => {
      const stdioOption = startCommand.options.find((opt) => opt.long === '--stdio');
      expect(stdioOption).toBeDefined();
    });
  });

  describe('Stop Command', () => {
    it('should have pid option', () => {
      const pidOption = stopCommand.options.find((opt) => opt.long === '--pid');
      expect(pidOption).toBeDefined();
    });
  });

  describe('Status Command', () => {
    it('should have pid option', () => {
      const pidOption = statusCommand.options.find((opt) => opt.long === '--pid');
      expect(pidOption).toBeDefined();
    });
  });

  describe('UI Command', () => {
    it('should have port option without hardcoded default (reads from config)', () => {
      const portOption = uiCommand.options.find((opt) => opt.long === '--port');
      expect(portOption).toBeDefined();
      expect(portOption?.defaultValue).toBeUndefined();
    });

    it('should have host option without hardcoded default (reads from config)', () => {
      const hostOption = uiCommand.options.find((opt) => opt.long === '--host');
      expect(hostOption).toBeDefined();
      expect(hostOption?.defaultValue).toBeUndefined();
    });
  });

  describe('List Command', () => {
    it('should have format option with default value', () => {
      const formatOption = listCommand.options.find((opt) => opt.long === '--format');
      expect(formatOption).toBeDefined();
      expect(formatOption?.defaultValue).toBe('table');
    });
  });

  describe('Restart Command', () => {
    it('should have port option with default value', () => {
      const portOption = restartCommand.options.find((opt) => opt.long === '--port');
      expect(portOption).toBeDefined();
      expect(portOption?.defaultValue).toBe('3000');
    });

    it('should have host option with default value', () => {
      const hostOption = restartCommand.options.find((opt) => opt.long === '--host');
      expect(hostOption).toBeDefined();
      expect(hostOption?.defaultValue).toBe('localhost');
    });
  });
});
