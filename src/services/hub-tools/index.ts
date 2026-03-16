// Re-export the original service for backward compatibility
export { HubToolsService, hubToolsService } from '../hub-tools.service.js';

// Export types and utilities from the new modules
export type { RequestOptions, ServerInstanceInfo, ValidServer } from './types.js';
export { hasValidId, selectBestInstance } from './server-selector.js';
export { getSystemTools } from './system-tool-definitions.js';
export type { ToolAnnotations, SystemToolDefinition } from './system-tool-definitions.js';
export { generateDynamicResources, readResource } from './resource-generator.js';
export type { ServerMetadata } from './resource-generator.js';
