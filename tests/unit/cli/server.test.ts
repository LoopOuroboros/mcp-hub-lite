import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as serverModule from '@cli/server.js';

// Mock dependencies
vi.mock('@src/app.js', () => ({
  buildApp: vi.fn()
}));
vi.mock('@pid/manager.js', () => ({
  PidManager: {
    writePid: vi.fn(),
    removePid: vi.fn(),
    getPid: vi.fn()
  }
}));
vi.mock('@services/hub-manager.service.js', () => ({
  hubManager: {
    getAllServers: vi.fn(),
    getServerInstances: vi.fn()
  }
}));

describe('CLI Server Functions', () => {
  let originalKill: (pid: number, signal?: string | number) => boolean;
  let mockKill: (pid: number, signal?: string | number) => boolean;

  beforeEach(() => {
    // Mock process.kill to prevent actual process killing during tests
    originalKill = process.kill as (pid: number, signal?: string | number) => boolean;
    mockKill = vi.fn() as (pid: number, signal?: string | number) => boolean;

    // Use Object.defineProperty to safely override process.kill
    Object.defineProperty(process, 'kill', {
      value: mockKill,
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    // Restore original methods
    Object.defineProperty(process, 'kill', {
      value: originalKill,
      writable: true,
      configurable: true
    });
    vi.clearAllMocks();
  });

  describe('startServer', () => {
    it('should be defined', () => {
      expect(serverModule.startServer).toBeDefined();
    });
  });

  describe('stopServer', () => {
    it('should be defined', () => {
      expect(serverModule.stopServer).toBeDefined();
    });
  });

  describe('getServerStatus', () => {
    it('should be defined', () => {
      expect(serverModule.getServerStatus).toBeDefined();
    });
  });

  describe('restartServer', () => {
    it('should be defined', () => {
      expect(serverModule.restartServer).toBeDefined();
    });
  });

  describe('listServers', () => {
    it('should be defined', () => {
      expect(serverModule.listServers).toBeDefined();
    });
  });
});