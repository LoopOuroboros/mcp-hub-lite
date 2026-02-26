import { hubToolsService } from './hub-tools.service.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '@utils/logger.js';
import {
  SystemToolName,
  LIST_SERVERS_TOOL,
  FIND_SERVERS_TOOL,
  LIST_ALL_TOOLS_IN_SERVER_TOOL,
  FIND_TOOLS_IN_SERVER_TOOL,
  GET_TOOL_TOOL,
  CALL_TOOL_TOOL,
  FIND_TOOLS_TOOL,
  MCP_HUB_LITE_SERVER,
  type FindServersParams,
  type ListAllToolsInServerParams,
  type FindToolsInServerParams,
  type GetToolParams,
  type CallToolParams,
  type FindToolsParams
} from '@models/system-tools.constants.js';
import { stringifyForLogging } from '@utils/json-utils.js';

/**
 * Unified system tool call handler
 */
export class SystemToolHandler {
  /**
   * Handles system tool calls
   */
  static async handleSystemToolCall(toolName: string, toolArgs: Record<string, unknown>): Promise<unknown> {
    logger.debug(`System tool called: ${toolName}, args=${stringifyForLogging(toolArgs)}`, {
      subModule: 'SYSTEM-TOOL'
    });

    try {
      let result;

      switch (toolName as SystemToolName) {
        case LIST_SERVERS_TOOL:
          result = await hubToolsService.listServers();
          break;
        case FIND_SERVERS_TOOL: {
          const findServersArgs = toolArgs as unknown as FindServersParams;
          result = await hubToolsService.findServers(
            findServersArgs.pattern,
            findServersArgs.searchIn,
            findServersArgs.caseSensitive
          );
          break;
        }
        case LIST_ALL_TOOLS_IN_SERVER_TOOL: {
          const listAllToolsArgs = toolArgs as unknown as ListAllToolsInServerParams;
          result = await hubToolsService.listAllToolsInServer(
            listAllToolsArgs.serverName,
            listAllToolsArgs.requestOptions
          );
          break;
        }
        case FIND_TOOLS_IN_SERVER_TOOL: {
          const findToolsInServerArgs = toolArgs as unknown as FindToolsInServerParams;
          result = await hubToolsService.findToolsInServer(
            findToolsInServerArgs.serverName,
            findToolsInServerArgs.pattern,
            findToolsInServerArgs.searchIn,
            findToolsInServerArgs.caseSensitive,
            findToolsInServerArgs.requestOptions
          );
          break;
        }
        case GET_TOOL_TOOL: {
          const getToolArgs = toolArgs as unknown as GetToolParams;
          result = await hubToolsService.getTool(
            getToolArgs.serverName,
            getToolArgs.toolName,
            getToolArgs.requestOptions
          );
          break;
        }
        case CALL_TOOL_TOOL: {
          const callToolArgs = toolArgs as unknown as CallToolParams;
          let serverName = callToolArgs.serverName;
          if (!serverName || serverName === 'undefined') {
            serverName = MCP_HUB_LITE_SERVER;
          }
          result = await hubToolsService.callTool(
            serverName,
            callToolArgs.toolName,
            callToolArgs.toolArgs,
            callToolArgs.requestOptions
          );
          break;
        }
        case FIND_TOOLS_TOOL: {
          const findToolsArgs = toolArgs as unknown as FindToolsParams;
          result = await hubToolsService.findTools(
            findToolsArgs.pattern,
            findToolsArgs.searchIn,
            findToolsArgs.caseSensitive
          );
          break;
        }
        default:
          throw new McpError(-32801, `Unknown system tool: ${toolName}`);
      }

      logger.info(`System tool SUCCESS: ${toolName}`, { subModule: 'SYSTEM-TOOL' });
      return result;
    } catch (error: unknown) {
      logger.error(`System tool FAILED: ${toolName}, error=${error instanceof Error ? error.message : String(error)}`, error, {
        subModule: 'SYSTEM-TOOL'
      });

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
