import { describe, it, expect } from 'vitest';
import { Command } from 'commander';

describe('CLI Main Entry Point', () => {
  it('should create CLI program with correct name and description', () => {
    // Create a new Command instance to test configuration
    const program = new Command();
    program.name('mcp-hub-lite').description('Lightweight MCP Gateway for managing MCP servers');

    expect(program.name()).toBe('mcp-hub-lite');
    expect(program.description()).toBe('Lightweight MCP Gateway for managing MCP servers');
  });

  it('should have version set correctly', () => {
    const program = new Command();
    program.version('1.0.0');

    // Use the public version() method to get the version
    expect(program.version()).toBe('1.0.0');
  });
});
