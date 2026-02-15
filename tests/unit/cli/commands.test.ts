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

    it('should have port option with default value', () => {
      // Check if port option exists and has correct default
      const portOption = startCommand.options.find((opt) => opt.long === '--port');
      expect(portOption).toBeDefined();
      expect(portOption?.defaultValue).toBe(3000);
    });

    it('should have host option with default value', () => {
      // Check if host option exists and has correct default
      const hostOption = startCommand.options.find((opt) => opt.long === '--host');
      expect(hostOption).toBeDefined();
      expect(hostOption?.defaultValue).toBe('localhost');
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
    it('should have port option with default value', () => {
      const portOption = uiCommand.options.find((opt) => opt.long === '--port');
      expect(portOption).toBeDefined();
      expect(portOption?.defaultValue).toBe('3000');
    });

    it('should have host option with default value', () => {
      const hostOption = uiCommand.options.find((opt) => opt.long === '--host');
      expect(hostOption).toBeDefined();
      expect(hostOption?.defaultValue).toBe('localhost');
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
