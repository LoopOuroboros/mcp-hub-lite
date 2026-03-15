/**
 * Log output management utilities.
 * This file contains MCP response detection and simplification functions.
 */

import type { LogLevel } from '@shared-types/common.types.js';
import { stringifyForLogging } from '../json-utils.js';
import { logger } from './index.js';
import { LOG_MODULES } from './log-modules.js';
import { logStorage } from '@services/log-storage.service.js';

/**
 * Interface for notifications/message parameters.
 */
interface NotificationMessageParams {
  level?: string;
  logger?: string;
  data?: unknown;
}

/**
 * Interface for notifications/message.
 */
interface NotificationMessage {
  method: string;
  params?: NotificationMessageParams;
}

/**
 * Check if a message is a notifications/message.
 *
 * @param message - The message to check
 * @returns true if the message is a notifications/message
 */
export function isNotificationMessage(message: unknown): message is NotificationMessage {
  if (typeof message === 'object' && message !== null) {
    const msg = message as Record<string, unknown>;
    return msg.method === 'notifications/message';
  }
  return false;
}

/**
 * Extract message content from notification data.
 *
 * @param data - The notification data
 * @returns The extracted message string
 */
function extractMessageFromData(data: unknown): string {
  if (typeof data === 'string') {
    return data;
  }
  if (typeof data === 'object' && data !== null) {
    const dataObj = data as Record<string, unknown>;
    if (typeof dataObj.message === 'string') {
      return dataObj.message;
    }
  }
  return stringifyForLogging(data);
}

/**
 * Log a notifications/message to the application logs.
 *
 * @param message - The notification message
 * @param context - Optional context (server name, session ID, etc.)
 * @param serverId - Optional server ID for log storage (for frontend display)
 */
export function logNotificationMessage(message: unknown, context: string, serverId?: string): void {
  if (!isNotificationMessage(message)) {
    return;
  }

  const params = message.params;
  if (!params) {
    return;
  }

  const level = params.level || 'info';
  const messageContent = params.data ? extractMessageFromData(params.data) : '';

  if (!messageContent) {
    return;
  }

  // Use params.logger as server name if available, otherwise use context
  const serverName = params.logger || context;

  // Map notification level to logger level
  let logLevel: LogLevel = 'info';
  switch (level.toLowerCase()) {
    case 'debug':
      logLevel = 'debug';
      break;
    case 'info':
      logLevel = 'info';
      break;
    case 'warn':
    case 'warning':
      logLevel = 'warn';
      break;
    case 'error':
      logLevel = 'error';
      break;
    default:
      logLevel = 'info';
  }

  // Use serverLog to log with server name and module context
  logger.serverLog(logLevel, serverName, messageContent, {
    module: LOG_MODULES.NOTIFICATIONS_MESSAGE.module
  });

  // Store in logStorage for frontend display if serverId is provided
  if (serverId) {
    logStorage.append(serverId, logLevel, `[${serverName}] ${messageContent}`);
  }
}

/**
 * Format an MCP message for logging, with simplification for tools/list,
 * resources/list, capabilities responses, and image content.
 *
 * @param message - The MCP message object to format
 * @returns Formatted log message string
 */
export function formatMcpMessageForLogging(message: unknown): string {
  try {
    const rawJson = JSON.stringify(message);
    let logMessage: string;

    if (isToolsListResponse(rawJson)) {
      const simplified = simplifyToolsListResponse(rawJson);
      if (simplified === null) {
        // Could not simplify, use pretty JSON formatting
        logMessage = stringifyForLogging(message);
      } else {
        logMessage = simplified;
      }
    } else if (hasImageContent(rawJson)) {
      const simplified = simplifyImageContent(rawJson);
      try {
        const parsed = JSON.parse(simplified);
        logMessage = stringifyForLogging(parsed);
      } catch {
        logMessage = simplified;
      }
    } else {
      logMessage = stringifyForLogging(message);
    }
    return logMessage;
  } catch {
    return '[Unserializable]';
  }
}

/**
 * Check if data contains image content with binary data.
 * @param data - stdout or response data
 * @returns true if it contains image content with data field
 */
export function hasImageContent(data: string): boolean {
  try {
    const trimmed = data.trim();

    if (trimmed.includes('event: message') && trimmed.includes('data:')) {
      const dataMatch = trimmed.match(/data: ([^\n]+)/);
      if (dataMatch) {
        const jsonData = dataMatch[1].trim();
        return hasImageContent(jsonData);
      }
    }

    if (trimmed.startsWith('{')) {
      const message = JSON.parse(trimmed) as unknown;
      if (typeof message === 'object' && message !== null) {
        const msg = message as { result?: unknown };
        if (msg.result && typeof msg.result === 'object' && msg.result !== null) {
          const result = msg.result as Record<string, unknown>;
          if ('content' in result && Array.isArray(result.content)) {
            const content = result.content as Array<Record<string, unknown>>;
            return content.some(
              (item) =>
                typeof item === 'object' && item !== null && item.type === 'image' && 'data' in item
            );
          }
        }
      }
    }
  } catch {
    // Non-JSON data, ignore
  }
  return false;
}

/**
 * Simplify image content by replacing binary data with placeholder.
 * @param data - Complete response data
 * @returns Log information with binary image data replaced
 */
export function simplifyImageContent(data: string): string {
  try {
    const trimmed = data.trim();

    if (trimmed.includes('event: message') && trimmed.includes('data:')) {
      const dataMatch = trimmed.match(/data: ([^\n]+)/);
      if (dataMatch) {
        const jsonData = dataMatch[1].trim();
        const simplified = simplifyImageContent(jsonData);
        return `event: message\ndata: ${simplified}`;
      }
    }

    if (trimmed.startsWith('{')) {
      const message = JSON.parse(trimmed) as unknown;
      if (typeof message === 'object' && message !== null) {
        const msg = message as { result?: unknown };
        if (msg.result && typeof msg.result === 'object' && msg.result !== null) {
          const result = msg.result as Record<string, unknown>;
          if ('content' in result && Array.isArray(result.content)) {
            const content = result.content as Array<Record<string, unknown>>;
            const modifiedContent = content.map((item) => {
              if (
                typeof item === 'object' &&
                item !== null &&
                item.type === 'image' &&
                'data' in item
              ) {
                return {
                  ...item,
                  data: '[BinaryImageData]'
                };
              }
              return item;
            });
            const modifiedResult = {
              ...result,
              content: modifiedContent
            };
            const modifiedMessage = {
              ...(message as Record<string, unknown>),
              result: modifiedResult
            };
            return JSON.stringify(modifiedMessage);
          }
        }
      }
    }
  } catch {
    // Parsing failed, return original data
  }

  return data;
}

/**
 * Check if data is a tools/list response.
 * @param data - stdout or response data
 * @returns true if it's a tools/list response
 */
export function isToolsListResponse(data: string): boolean {
  try {
    const trimmed = data.trim();

    if (trimmed.includes('event: message') && trimmed.includes('data:')) {
      const dataMatch = trimmed.match(/data: ([^\n]+)/);
      if (dataMatch) {
        const jsonData = dataMatch[1].trim();
        return isToolsListResponse(jsonData);
      }
    }

    if (trimmed.startsWith('{')) {
      const message = JSON.parse(trimmed) as unknown;
      if (typeof message === 'object' && message !== null) {
        const msg = message as { result?: unknown };
        if (msg.result && typeof msg.result === 'object' && msg.result !== null) {
          const result = msg.result as Record<string, unknown>;
          if ('tools' in result) {
            return true;
          }
          if ('resources' in result) {
            return true;
          }
          if (
            'capabilities' in result &&
            typeof result.capabilities === 'object' &&
            result.capabilities !== null
          ) {
            const capabilities = result.capabilities as Record<string, unknown>;
            if ('tools' in capabilities || 'resources' in capabilities) {
              return true;
            }
          }
        }
      }
    }
  } catch {
    // Non-JSON data, ignore
  }
  return false;
}

/**
 * Simplify tools/list response log information.
 * @param data - Complete response data
 * @returns Simplified log information, or null if cannot be simplified
 */
export function simplifyToolsListResponse(data: string): string | null {
  try {
    const trimmed = data.trim();

    if (trimmed.includes('event: message') && trimmed.includes('data:')) {
      const dataMatch = trimmed.match(/data: ([^\n]+)/);
      if (dataMatch) {
        const jsonData = dataMatch[1].trim();
        const simplified = simplifyToolsListResponse(jsonData);
        if (simplified === null) {
          return null;
        }
        return `event: message\ndata: ${simplified}`;
      }
    }

    if (trimmed.startsWith('{')) {
      const message = JSON.parse(trimmed) as unknown;
      if (typeof message === 'object' && message !== null) {
        const msg = message as { result?: unknown };
        if (msg.result && typeof msg.result === 'object' && msg.result !== null) {
          const result = msg.result as Record<string, unknown>;

          if ('tools' in result) {
            const toolsCount = Array.isArray(result.tools) ? result.tools.length : 0;
            if (toolsCount > 0) {
              return `Returned ${toolsCount} tools`;
            }
            // No tools, don't simplify
            return null;
          }

          if ('resources' in result) {
            const resourcesCount = Array.isArray(result.resources) ? result.resources.length : 0;
            if (resourcesCount > 0) {
              return `Returned ${resourcesCount} resources`;
            }
            // No resources, don't simplify
            return null;
          }

          if (
            'capabilities' in result &&
            typeof result.capabilities === 'object' &&
            result.capabilities !== null
          ) {
            const capabilities = result.capabilities as Record<string, unknown>;
            let toolsCount = 0;
            let resourcesCount = 0;

            if (
              'tools' in capabilities &&
              typeof capabilities.tools === 'object' &&
              capabilities.tools !== null
            ) {
              toolsCount = Object.keys(capabilities.tools as Record<string, unknown>).length;
            }

            if (
              'resources' in capabilities &&
              typeof capabilities.resources === 'object' &&
              capabilities.resources !== null
            ) {
              resourcesCount = Object.keys(
                capabilities.resources as Record<string, unknown>
              ).length;
            }

            if (toolsCount > 0 && resourcesCount > 0) {
              return `Returned ${toolsCount} tools and ${resourcesCount} resources`;
            } else if (toolsCount > 0) {
              return `Returned ${toolsCount} tools`;
            } else if (resourcesCount > 0) {
              return `Returned ${resourcesCount} resources`;
            }
            // No tools or resources, don't simplify
            return null;
          }
        }
      }
    }
  } catch {
    // Parsing failed, don't simplify
  }

  // Could not simplify
  return null;
}
