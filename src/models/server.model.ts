import type { ServerStatus, ServerTransport } from '@shared-types/common.types.js';
import type { ServerConfig as SharedServerConfig } from '@shared-models/server.model';

// Backend server configuration interface, extending shared configuration
export interface ServerConfig extends Omit<SharedServerConfig, 'type'> {
  id: string;
  name: string;
  command: string;
  args: string[];
  type: ServerTransport;
  enabled: boolean;
}

// Server state interface
export interface ServerState {
  status: ServerStatus;
  lastCheck: number;
  error?: string;
  pid?: number;
}

// Backend server model interface, extending shared server model
export interface Server extends ServerConfig, ServerState {}
