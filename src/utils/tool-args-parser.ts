/**
 * Tool arguments parser
 */
export class ToolArgsParser {
  /**
   * Parses prefixed tool names (like mcp__mcp-hub-lite__xxx)
   */
  static parsePrefixedToolName(toolName: string): { serverName: string; toolName: string } | null {
    if (!toolName.includes('__')) {
      return null;
    }

    const doubleUnderscoreIndex = toolName.indexOf('__');
    const secondDoubleUnderscoreIndex = toolName.indexOf('__', doubleUnderscoreIndex + 2);

    if (secondDoubleUnderscoreIndex === -1) {
      return null;
    }

    const serverName = toolName.substring(doubleUnderscoreIndex + 2, secondDoubleUnderscoreIndex);
    const parsedToolName = toolName.substring(secondDoubleUnderscoreIndex + 2);

    if (!serverName || !parsedToolName) {
      return null;
    }

    return {
      serverName,
      toolName: parsedToolName
    };
  }

  /**
   * Validates tool argument types
   */
  static validateToolArgs(): boolean {
    // 可以根据工具名称验证参数类型
    return true;
  }
}
