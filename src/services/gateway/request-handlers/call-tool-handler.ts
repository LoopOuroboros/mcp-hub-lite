/**
 * Call tool request handler for Gateway service.
 */

import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { logger, LOG_MODULES } from '@utils/index.js';
import { stringifyForLogging } from '@utils/json-utils.js';
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
 * Type guard to check if a result is a valid CallToolResult.
 *
 * @param result - The result to check
 * @returns True if result has the expected CallToolResult structure
 */
function isCallToolResult(result: unknown): result is CallToolResult {
  return (
    !!result && typeof result === 'object' && 'content' in result && Array.isArray(result.content)
  );
}

/**
 * Executes a system tool call via the SystemToolHandler.
 *
 * @param toolName - Name of the system tool to call
 * @param toolArgs - Arguments to pass to the tool
 * @returns CallToolResult with the tool execution result
 */
async function executeSystemToolCall(
  toolName: string,
  toolArgs: Record<string, unknown>
): Promise<CallToolResult> {
  try {
    const result = await SystemToolHandler.handleSystemToolCall(toolName, toolArgs);

    if (isCallToolResult(result)) {
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

/**
 * Parses a tool name to check if it refers to a system tool.
 * Handles both direct system tool names (e.g., "list_servers") and
 * prefixed names (e.g., "mcp__mcp-hub-lite__list_servers").
 *
 * @param toolName - The tool name to parse
 * @returns The system tool name if it's a system tool, null otherwise
 */
function getSystemToolName(toolName: string): string | null {
  const parsedTool = ToolArgsParser.parsePrefixedToolName(toolName);
  if (parsedTool) {
    logger.debug(
      `Parsed prefixed tool name: "${toolName}" → server="${parsedTool.serverName}", tool="${parsedTool.toolName}"`,
      LOG_MODULES.GATEWAY
    );

    if (
      parsedTool.serverName === MCP_HUB_LITE_SERVER &&
      SYSTEM_TOOL_NAMES.includes(parsedTool.toolName as SystemToolName)
    ) {
      logger.info(
        `System tool called via prefixed name: ${parsedTool.toolName}`,
        LOG_MODULES.GATEWAY
      );
      return parsedTool.toolName;
    }
  }

  if (SYSTEM_TOOL_NAMES.includes(toolName as SystemToolName)) {
    return toolName;
  }

  return null;
}

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
    const systemToolName = getSystemToolName(toolName);

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
    if (systemToolName) {
      logger.debug(
        `System tool called: ${systemToolName}, args=${formatToolArgs(toolArgs)}`,
        LOG_MODULES.GATEWAY
      );
      return await executeSystemToolCall(systemToolName, toolArgs);
    }

    // Per-request transport creates a fresh toolMap each time.
    // If tools/list hasn't been called on this transport yet, populate on demand.
    if (toolMap.size === 0) {
      logger.debug(
        'ToolMap is empty, generating gateway tools list on demand for call routing',
        LOG_MODULES.GATEWAY
      );
      generateGatewayToolsList(toolMap);
    }

    const target = toolMap.get(toolName);

    logger.debug(
      `Tool lookup SUCCESS: toolName=${toolName} -> serverName=${target?.serverName}, serverIndex=${target?.serverIndex}, realToolName=${target?.realToolName}`,
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
      logger.debug(
        `Tool call EXECUTING: serverName=${target.serverName}, serverIndex=${target.serverIndex}, realToolName=${target.realToolName}, args=${formatToolArgs(toolArgs)}`,
        LOG_MODULES.GATEWAY
      );

      const result = await mcpConnectionManager.callTool(
        target.serverName,
        target.serverIndex,
        target.realToolName,
        toolArgs
      );

      const duration = Date.now() - startTime;
      logger.info(
        `Tool call SUCCESS: serverName=${target.serverName}, serverIndex=${target.serverIndex}, realToolName=${target.realToolName}, duration=${duration}ms, response=${formatToolResponse(result)}`,
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
      ErrorHandler.handleToolCallError(
        `${target.serverName}-${target.serverIndex}`,
        target.realToolName,
        error
      );
    }
  });
}
