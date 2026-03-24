/**
 * Test helper types for MCP Hub Lite integration tests
 */

// Mock server configuration for tests
export interface MockServerConfig {
  id: string;
  name: string;
  config: {
    aggregatedTools?: string[];
  };
  instance: {
    id: string;
    timestamp: number;
  };
}

// Mock tool for tests
export interface MockTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverId: string;
}

// System tool definitions
export interface SystemTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
