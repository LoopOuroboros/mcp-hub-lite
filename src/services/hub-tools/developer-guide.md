# Hub Tools Developer Guide

## Overview

This guide provides instructions for developers working with the Hub Tools module, especially when adding new system tools or modifying existing ones.

## Critical Convention: MCP_HUB_LITE_SERVER Handling

### IMPORTANT: Always Add Special Case for MCP_HUB_LITE_SERVER

When adding new methods to `HubToolsService` or modifying existing ones that handle server names, **you MUST always add a special case to handle `MCP_HUB_LITE_SERVER` (which equals "mcp-hub-lite")**.

### Background

The `mcp-hub-lite` server is a **virtual server** that doesn't represent a real connected MCP server. Instead, it provides access to system tools that are part of the MCP Hub Lite gateway itself.

### Affected Methods

Any method that takes a `serverName` parameter and interacts with tools MUST handle this special case. Currently, these methods include:

1. `listToolsInServer()` - Already implemented ✓
2. `getTool()` - Already implemented ✓
3. `callTool()` - Already implemented ✓

### Pattern to Follow

When implementing or modifying a method that handles server names, use this pattern:

```typescript
async someMethod(args: SomeParams): Promise<SomeResult> {
  // Handle MCP Hub Lite server FIRST
  if (typeof args.serverName === 'string' && args.serverName === MCP_HUB_LITE_SERVER) {
    // System tool handling logic here
    return systemToolResult;
  }

  // Regular MCP server handling
  const serverInfo = selectBestInstance(args.serverName, args.requestOptions);
  // ... rest of the implementation
}
```

### Example: getTool() Implementation

Here's how the `getTool()` method implements this pattern:

```typescript
async getTool(args: GetToolParams): Promise<Tool | undefined> {
  // Handle MCP Hub Lite server (return system tool)
  if (typeof args.serverName === 'string' && args.serverName === MCP_HUB_LITE_SERVER) {
    const systemTools = getSystemTools();
    const found = systemTools.find((tool) => tool.name === args.toolName);
    if (found) {
      return {
        ...found,
        serverName: MCP_HUB_LITE_SERVER
      };
    }
    return undefined;
  }

  // Regular MCP server handling
  const serverInfo = selectBestInstance(args.serverName, args.requestOptions);

  if (!serverInfo) {
    throw new Error(`Server not found: ${args.serverName}`);
  }

  const tools = mcpConnectionManager.getTools(serverInfo.instance.id);
  return tools.find((tool) => tool.name === args.toolName);
}
```

### Key Points

1. **Check for `MCP_HUB_LITE_SERVER` FIRST** - Always handle the virtual server case before attempting to find a real server instance

2. **Use `getSystemTools()`** - For system tools, retrieve them from the `getSystemTools()` function, not from the connection manager

3. **Add `serverName` field** - When returning system tools, add the `serverName: MCP_HUB_LITE_SERVER` field to match the `Tool` interface

4. **Don't use `selectBestInstance()`** - For `mcp-hub-lite`, don't try to find a server instance - it doesn't exist as a connected server

## Adding New System Tools

When adding a new system tool, follow these steps:

### Step 1: Add to System Tools Constants

Update `src/models/system-tools.constants.ts`:

1. Add the tool name constant
2. Add to the `SYSTEM_TOOL_NAMES` array
3. Add the parameter type definition

### Step 2: Add Tool Definition

Update `src/services/hub-tools/system-tool-definitions.ts`:

1. Add a case in the `getSystemTools()` function
2. Provide name, description, inputSchema, and annotations

### Step 3: Add Implementation

Update `src/services/hub-tools.service.ts`:

1. Add the implementation method
2. **REMEMBER TO ADD THE `MCP_HUB_LITE_SERVER` SPECIAL CASE IF NEEDED**
3. Add a case in the `callSystemTool()` switch statement

### Step 4: Update Type Imports

Make sure all necessary types are imported and exported correctly.

## Testing Checklist

When making changes to HubToolsService, always test:

- [ ] System tools work with `serverName="mcp-hub-lite"`
- [ ] Regular MCP servers still work correctly
- [ ] All methods handle edge cases gracefully
- [ ] TypeScript compilation passes (`npm run build`)
- [ ] All tests pass (`npm run test`)
- [ ] ESLint checks pass (`npm run lint`)

## Common Pitfalls to Avoid

1. **Forgetting the special case** - Always check for `MCP_HUB_LITE_SERVER` first
2. **Using `selectBestInstance()` for system tools** - This will fail with "Server not found"
3. **Missing `serverName` field** - System tools need this field to match the `Tool` interface
4. **Not testing both cases** - Always test both system tools and regular MCP server tools

## Related Files

- `src/services/hub-tools.service.ts` - Main service implementation
- `src/services/hub-tools/system-tool-definitions.ts` - System tool definitions
- `src/models/system-tools.constants.ts` - Constants and types
- `src/services/hub-tools/use-guide.md` - User guide for the gateway

---

_Last updated: 2026-03-17_
