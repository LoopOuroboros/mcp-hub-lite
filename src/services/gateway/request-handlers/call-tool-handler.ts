/**
 * Call tool request handler for Gateway service.
 */

import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger, LOG_MODULES } from '@utils/index.js';
import { stringifyForLogging } from '@utils/json-utils.js';
import { getClientCwd } from '@utils/request-context.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { SystemToolHandler } from '@services/system-tool-handler.js';
import { ErrorHandler } from '@utils/error-handler.js';
import { ToolArgsParser } from '@utils/tool-args-parser.js';
import {
  SYSTEM_TOOL_NAMES,
  SystemToolName,
  MCP_HUB_LITE_SERVER
} from '@models/system-tools.constants.js';
import { formatToolArgs, formatToolResponse } from '../log-formatter.js';
import { generateGatewayToolsList } from '../tool-list-generator.js';
import type { ToolMapEntry } from '../types.js';

/**
 * Register call tool handler on the MCP server.
 *
 * @param server - MCP server instance to register handlers on
 * @param toolMap - Tool map for routing tool calls
 */
export function registerCallToolHandler(
  server: McpServer,
  toolMap: Map<string, ToolMapEntry>
): void {
  // Original list tools handler (for compatibility)

  server.server.setRequestHandler(ListToolsRequestSchema, async () => {
    const gatewayTools = generateGatewayToolsList(toolMap);
    return {
      tools: gatewayTools
    };
  });

  // Original call tool handler (for compatibility)
  server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const toolArgs: Record<string, unknown> = request.params.arguments || {};

    // Parse prefixed tool names (like mcp__mcp-hub-lite__xxx) if applicable
    // This handles Claude Code style tool names with server prefix
    const parsedTool = ToolArgsParser.parsePrefixedToolName(toolName);
    if (parsedTool) {
      logger.debug(
        `Parsed prefixed tool name: "${toolName}" → server="${parsedTool.serverName}", tool="${parsedTool.toolName}"`,
        LOG_MODULES.GATEWAY
      );

      // Check if it's a system tool call
      if (
        parsedTool.serverName === MCP_HUB_LITE_SERVER &&
        SYSTEM_TOOL_NAMES.includes(parsedTool.toolName as SystemToolName)
      ) {
        logger.info(
          `System tool called via prefixed name: ${parsedTool.toolName}`,
          LOG_MODULES.GATEWAY
        );

        try {
          const result = await SystemToolHandler.handleSystemToolCall(
            parsedTool.toolName,
            toolArgs
          );

          if (
            result &&
            typeof result === 'object' &&
            'content' in result &&
            Array.isArray(result.content)
          ) {
            return result;
          }

          return {
            content: [
              {
                type: 'text',
                text: stringifyForLogging(result)
              }
            ]
          };
        } catch (error) {
          ErrorHandler.handleSystemToolError(parsedTool.toolName, error);
        }
      }
    }

    // Log incoming tool request with full context
    logger.info(
      `Tool call REQUEST received: toolName=${toolName}, args=${formatToolArgs(toolArgs)}`,
      LOG_MODULES.GATEWAY
    );
    logger.debug(
      `Tool context: toolMap size=${toolMap.size}, available tools=${Array.from(toolMap.keys()).slice(0, 10).join(', ')}${toolMap.size > 10 ? '...' : ''}`,
      LOG_MODULES.GATEWAY
    );

    // Handle system tools
    if (typeof toolName === 'string' && SYSTEM_TOOL_NAMES.includes(toolName as SystemToolName)) {
      logger.debug(
        `System tool called: ${toolName}, args=${formatToolArgs(toolArgs)}`,
        LOG_MODULES.GATEWAY
      );

      try {
        const result = await SystemToolHandler.handleSystemToolCall(toolName, toolArgs);

        if (
          result &&
          typeof result === 'object' &&
          'content' in result &&
          Array.isArray(result.content)
        ) {
          return result;
        }

        return {
          content: [
            {
              type: 'text',
              text: stringifyForLogging(result)
            }
          ]
        };
      } catch (error) {
        ErrorHandler.handleSystemToolError(toolName, error);
      }
    }

    const target = toolMap.get(toolName);

    logger.debug(
      `Tool lookup SUCCESS: toolName=${toolName} -> serverId=${target?.serverId}, realToolName=${target?.realToolName}`,
      LOG_MODULES.GATEWAY
    );

    if (!target) {
      logger.error(
        `Tool NOT FOUND: toolName=${toolName}, available tools=${Array.from(toolMap.keys()).join(', ')}`,
        LOG_MODULES.GATEWAY
      );
      throw new McpError(-32801, `Tool ${toolName} not found`);
    }

    const startTime = Date.now();
    try {
      // Inject CWD if available and not present in args
      const cwd = getClientCwd();
      if (cwd && !toolArgs.cwd) {
        toolArgs.cwd = cwd;
        logger.debug(
          `Injected CWD into tool call ${toolName}: ${cwd}`,
          LOG_MODULES.dynamic(toolName)
        );
      }
      logger.debug(
        `Tool call EXECUTING: serverId=${target.serverId}, realToolName=${target.realToolName}, args=${formatToolArgs(toolArgs)}`,
        LOG_MODULES.GATEWAY
      );

      const result = await mcpConnectionManager.callTool(
        target.serverId,
        target.realToolName,
        toolArgs
      );

      const duration = Date.now() - startTime;
      logger.info(
        `Tool call SUCCESS: serverId=${target.serverId}, realToolName=${target.realToolName}, duration=${duration}ms, response=${formatToolResponse(result)}`,
        LOG_MODULES.GATEWAY
      );

      // Wrap the result in a valid CallToolResult structure
      if (typeof result === 'object' && result !== null) {
        return {
          content: [],
          ...result
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: String(result)
            }
          ]
        };
      }
    } catch (error: unknown) {
      ErrorHandler.handleToolCallError(target.serverId, target.realToolName, error);
    }
  });
}
