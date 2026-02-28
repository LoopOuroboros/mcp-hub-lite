/**
 * Log output management utilities.
 * This file contains MCP response detection and simplification functions.
 */

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
 * @returns Simplified log information
 */
export function simplifyToolsListResponse(data: string): string {
  try {
    const trimmed = data.trim();

    if (trimmed.includes('event: message') && trimmed.includes('data:')) {
      const dataMatch = trimmed.match(/data: ([^\n]+)/);
      if (dataMatch) {
        const jsonData = dataMatch[1].trim();
        const simplified = simplifyToolsListResponse(jsonData);
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
            return `Returned ${toolsCount} tools`;
          }

          if ('resources' in result) {
            const resourcesCount = Array.isArray(result.resources) ? result.resources.length : 0;
            return `Returned ${resourcesCount} resources`;
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
          }
        }
      }
    }
  } catch {
    // Parsing failed, return truncated version of original data
  }

  return data.length > 200 ? data.substring(0, 200) + '...' : data;
}
