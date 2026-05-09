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

// Re-export shared constants (includes both value and type)
export { InstanceSelectionStrategy } from '@shared-models/server.model.js';
