import { describe, it, expect } from 'vitest';
import { startCommand } from '@cli/commands/start.js';
import { stopCommand } from '@cli/commands/stop.js';
import { statusCommand } from '@cli/commands/status.js';
import { uiCommand } from '@cli/commands/ui.js';
import { listCommand } from '@cli/commands/list.js';
import { restartCommand } from '@cli/commands/restart.js';

describe('CLI Commands', () => {
  it('should create start command with correct properties', () => {
    expect(startCommand.name()).toBe('start');
    expect(startCommand.description()).toBe('Start the MCP Hub Lite server');
  });

  it('should create stop command with correct properties', () => {
    expect(stopCommand.name()).toBe('stop');
    expect(stopCommand.description()).toBe('Stop the MCP Hub Lite server');
  });

  it('should create status command with correct properties', () => {
    expect(statusCommand.name()).toBe('status');
    expect(statusCommand.description()).toBe('Get the status of MCP Hub Lite server');
  });

  it('should create ui command with correct properties', () => {
    expect(uiCommand.name()).toBe('ui');
    expect(uiCommand.description()).toBe('Open the MCP Hub Lite web UI in browser');
  });

  it('should create list command with correct properties', () => {
    expect(listCommand.name()).toBe('list');
    expect(listCommand.description()).toBe('List all configured MCP servers');
  });

  it('should create restart command with correct properties', () => {
    expect(restartCommand.name()).toBe('restart');
    expect(restartCommand.description()).toBe('Restart the MCP Hub Lite server');
  });
});
