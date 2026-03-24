import type { ServerStatus, ServerTransport } from '@shared-types/common.types.js';
import type {
  ServerConfig as SharedServerConfig,
  ServerTemplate as SharedServerTemplate,
  ServerInstance as SharedServerInstance,
  ServerRuntimeConfig as SharedServerRuntimeConfig,
  ServerInstanceConfig as SharedServerInstanceConfig,
  TagDefinition as SharedTagDefinition,
  SystemConfig as SharedSystemConfig,
  LoggingConfig as SharedLoggingConfig,
  SecurityConfig as SharedSecurityConfig,
  Server as SharedServer,
  StatusInfo as SharedStatusInfo,
  LogEntry as SharedLogEntry
} from '@shared-models/server.model.js';

// ====== Backward Compatibility - Re-export everything from shared module ======

// Re-export shared types with backward-compatible names
export type {
  SharedServerConfig as ServerConfig,
  SharedServerTemplate as ServerTemplate,
  SharedServerInstance as ServerInstance,
  SharedServerRuntimeConfig as ServerRuntimeConfig,
  SharedServerInstanceConfig as ServerInstanceConfig,
  SharedTagDefinition as TagDefinition,
  SharedSystemConfig as SystemConfig,
  SharedLoggingConfig as LoggingConfig,
  SharedSecurityConfig as SecurityConfig,
  SharedServer as Server,
  SharedStatusInfo as StatusInfo,
  SharedLogEntry as LogEntry
};

// ====== Legacy Backend Server Configuration (for backward compatibility) ======

/**
 * @deprecated Use ServerConfig from @shared-models/server.model instead
 * Backend server configuration interface, extending shared configuration
 */
export interface LegacyBackendServerConfig extends Omit<SharedServerConfig, 'type'> {
  id: string;
  name: string;
  command: string;
  args: string[];
  type: ServerTransport;
  enabled: boolean;
}

/**
 * @deprecated Use appropriate types from @shared-models/server.model instead
 * Server state interface
 */
export interface ServerState {
  status: ServerStatus;
  lastCheck: number;
  error?: string;
  pid?: number;
}

/**
 * @deprecated Use Server from @shared-models/server.model instead
 * Backend server model interface, extending shared server model
 */
export interface LegacyBackendServer extends LegacyBackendServerConfig, ServerState {}
