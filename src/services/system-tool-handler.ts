import { hubToolsService } from './hub-tools.service.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { logger, LOG_MODULES } from '@utils/logger.js';
import {
  SystemToolName,
  LIST_SERVERS_TOOL,
  LIST_TOOLS_IN_SERVER_TOOL,
  GET_TOOL_TOOL,
  CALL_TOOL_TOOL,
  UPDATE_SERVER_DESCRIPTION_TOOL,
  MCP_HUB_LITE_SERVER
} from '@models/system-tools.constants.js';
import type {
  ListToolsInServerParams,
  GetToolParams,
  CallToolParams,
  UpdateServerDescriptionParams
} from '@models/system-tools.constants.js';
import { stringifyForLogging } from '@utils/json-utils.js';

/**
 * Unified system tool call handler
 */
export class SystemToolHandler {
  /**
   * Handles system tool calls
   */
  static async handleSystemToolCall(
    toolName: string,
    toolArgs: Record<string, unknown>
  ): Promise<unknown> {
    logger.debug(
      `System tool called: ${toolName}, args=${stringifyForLogging(toolArgs)}`,
      LOG_MODULES.SYSTEM_TOOL
    );

    try {
      let result;

      switch (toolName as SystemToolName) {
        case LIST_SERVERS_TOOL:
          result = await hubToolsService.listServers();
          break;
        case LIST_TOOLS_IN_SERVER_TOOL: {
          const listToolsArgs = toolArgs as unknown as ListToolsInServerParams;
          result = await hubToolsService.listToolsInServer(listToolsArgs);
          break;
        }
        case GET_TOOL_TOOL: {
          const getToolArgs = toolArgs as unknown as GetToolParams;
          result = await hubToolsService.getTool(getToolArgs);
          break;
        }
        case CALL_TOOL_TOOL: {
          const callToolArgs = toolArgs as unknown as CallToolParams;
          let serverName = callToolArgs.serverName;
          if (!serverName || serverName === 'undefined') {
            serverName = MCP_HUB_LITE_SERVER;
          }
          result = await hubToolsService.callTool({
            ...callToolArgs,
            serverName
          });
          break;
        }
        case UPDATE_SERVER_DESCRIPTION_TOOL: {
          const updateDescArgs = toolArgs as unknown as UpdateServerDescriptionParams;
          result = await hubToolsService.updateServerDescription(updateDescArgs);
          break;
        }
        default:
          throw new McpError(-32801, `Unknown system tool: ${toolName}`);
      }

      logger.info(`System tool SUCCESS: ${toolName}`, LOG_MODULES.SYSTEM_TOOL);
      return result;
    } catch (error: unknown) {
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
  }
}
