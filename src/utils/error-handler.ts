import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { logger, LOG_MODULES } from '@utils/logger.js';

/**
 * Unified error handler
 */
export class ErrorHandler {
  /**
   * Handles system tool errors
   */
  static handleSystemToolError(toolName: string, error: unknown): never {
    logger.error(
      `System tool FAILED: ${toolName}, error=${error instanceof Error ? error.message : String(error)}`,
      error,
      LOG_MODULES.SYSTEM_TOOL
    );

    if (error instanceof McpError) {
      throw error;
    } else if (error instanceof Error) {
      throw new McpError(-32802, error.message || 'System Tool Error');
    } else {
      throw new McpError(-32802, String(error) || 'System Tool Error');
    }
  }

  /**
   * Handles tool call errors
   */
  static handleToolCallError(serverId: string, realToolName: string, error: unknown): never {
    if (error instanceof Error) {
      logger.error(
        `Tool call FAILED: serverId=${serverId}, realToolName=${realToolName}, error=${error.message}`,
        LOG_MODULES.GATEWAY
      );

      if (error.stack) {
        logger.debug(`Error stack for ${realToolName}:`, error.stack, LOG_MODULES.GATEWAY);
      }

      if (error instanceof McpError) {
        throw error;
      }

      if (error.message?.includes('not connected')) {
        throw new McpError(-32001, `Server not reachable: ${error.message}`);
      }

      throw new McpError(-32802, error.message || 'Internal Gateway Error');
    } else {
      logger.error(
        `Tool call FAILED: serverId=${serverId}, realToolName=${realToolName}, error=${String(error)}`,
        LOG_MODULES.GATEWAY
      );
      throw new McpError(-32802, String(error) || 'Internal Gateway Error');
    }
  }

  /**
   * Handles general errors
   */
  static handleGeneralError(error: unknown, message: string): never {
    logger.error(message, error);

    if (error instanceof McpError) {
      throw error;
    } else if (error instanceof Error) {
      throw new McpError(-32802, error.message);
    } else {
      throw new McpError(-32802, String(error));
    }
  }
}
