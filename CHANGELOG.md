# Changelog

## 2026-04-14

- **Lint Fix**: Remove unnecessary escape character in CLI entry detection
- **Docs**: Format README files for release
- **Version**: Bump version to 1.2.1
- **CLI Fix**: Fix CLI entry detection for Windows/npm symlink environments
- **CLI Refactor**: Fix command count and rename mcpToolUseCommand to toolUseCommand
- **Config Refactor**: Change config loading logs from info to debug level
- **Core Feature**: Add normalizeToolName for cross-format tool name matching
- **CLI Feature**: Add tool-use command for MCP server tool operations
- **Gateway Feature**: Implement per-request transport mode to fix connection errors

## 2026-04-13

- **Deps**: Add undici dependency for HTTP transport
- **Frontend Fix**: Prevent runtime error when tool is undefined in groupedTools
- **Version**: Bump version to 1.1.0
- **Core Refactor**: Use composite key serverName-serverIndex instead of serverId
- **Resource Feature**: Implement MCP native resource forwarding
- **Docs**: Update search functionality description in CLAUDE.md
- **Hub Tools Refactor**: Add non-strict mode to selectBestInstance
- **Search Refactor**: Remove complex search module, simplify to string matching
- **Test Refactor**: Remove evaluation tests not compliant with MCP spec

## 2026-04-12

- **Config Refactor**: Move instance selection strategy to template
- **Frontend Refactor**: Improve type declarations and test type safety
- **Frontend Refactor**: Compute instance counts from server.instances directly
- **Gateway Feature**: Restrict call_tool from invoking system tools
- **Docs**: Compress use-guide from 13 to 7 sections
- **Gateway Fix**: Return 400 for missing Accept header

## 2026-04-10

- **Transport Refactor**: Use official SDK StdioClientTransport
- **Stdio Transport Refactor**: Log non-JSON-RPC stdout and unify stderr log level
- **Frontend Fix**: Fix tools and resources not displaying in server detail
- **Frontend Fix**: Add description field to ConfigTemplateForm
- **Tools Fix**: Handle nested toolArgs in updateServerDescription

## 2026-04-09

- **Security Feature**: Mask sensitive values in config change logs
- **Frontend Fix**: Improve instance status reactivity and management
- **i18n Fix**: Improve noToolsFound message to reflect tool aggregation
- **Frontend Fix**: Add bottom padding to prevent save button cutoff on scroll
- **Gateway Refactor**: Extract version and protocol version to shared utility
- **Config Refactor**: Unify instance ID generation with content hash

## 2026-04-08

- **MCP Status Fix**: Prevent automatic enabled field updates on connect/disconnect
- **Chore**: Update .gitignore to ignore .full-review directory

## 2026-04-07

- **Frontend Fix**: Fix TypeScript type errors in component event handlers

## 2026-04-04

- **Test Refactor**: Simplify ServerStatusTags tests with mocks
- **Config Feature**: Sort env and headers keys on config save
- **Proxy Feature**: Add proxy configuration support for SSE and Streamable HTTP transports

## 2026-04-03

- **Config Feature**: Sort env and headers keys on config save
- **Config Refactor**: Optimize updateServerInstance logging
- **Connection Refactor**: Improve serverId handling and protocol version support

## 2026-04-02

- **Docs**: Update CLAUDE.md documentation for logging and composables
- **Logging Refactor**: Enhance transport logging with serverId context
- **Transports Feature**: Add LineBuffer for proper stderr line buffering
- **Logging Refactor**: Enhance logging module and configuration change tracking
- **Docs**: Update CLAUDE.md documentation for v1.1 config refactor

## 2026-04-01

- **Config Refactor**: Complete v1.1 multi-instance configuration refactoring
- **Docs**: Update CLAUDE.md files to reflect session removal
- **Session Refactor**: Remove session persistence mechanism and use SDK native stateless mode
- **Session Refactor**: Remove session persistence mechanism

## 2026-03-31

- **UI Fix**: Ensure log viewer area fills available container height
- **Frontend Feature**: Add instance tab routing synchronization

## 2026-03-29

- **i18n Fix**: Correct missing translation key in InstanceConfig component

## 2026-03-28

- **Hub Tools Feature**: Implement instance selection strategies

## 2026-03-27

- **Docs**: Update CLAUDE.md files across project modules
- **Session Feature**: Remove cwd and project fields from session management
- **UI Fix**: Optimize instance list display in English and hide redundant Running tag
- **Config Fix**: Ensure server instance indexes from config load and migration

## 2026-03-26

- **Config Feature**: Implement v1.1 instance configuration system

## 2026-03-25

- **Config Fix**: Support string index type for server instance operations
- **Docs**: Update CLAUDE.md files to reflect recent v1.1 config changes
- **Config Feature**: Enhance instance management with display name and route selection

## 2026-03-24

- **Config Refactor**: Activate v1.1 config format with instance support
- **Gateway Fix**: Only include tools from servers with allowedTools configured
- **Hub Tools Fix**: Support both toolArgs and arguments for backward compatibility

## 2026-03-23

- **Config Refactor**: Activate v1.1 config format, remove v1.0 compatibility code
- **Config Feature**: Add empty value cleaning when saving config

## 2026-03-20

- **UI Fix**: Correct dark mode background color and refine instance UI
- **UI Feature**: Add server instance management UI components
- **Config Feature**: Add index and displayName to ServerInstanceConfig with reassignment API
- **UI Feature**: Add tag management UI with TagManager component
- **Config Feature**: Add v1.1 config schema with auto-migration support

## 2026-03-19

- **i18n Fix**: Fix headers label and add button text in server config
- **UI Feature**: Add description field support in AddServerModal

## 2026-03-17

- **UI Enhancement**: Update resource detail and list views with hub tools integration
- **System Tools Refactor**: Enhance system tools handling and API endpoints
- **Hub Tools Refactor**: Restructure core hub tools service architecture

## 2026-03-15

- **Lint Fix**: Add fallback for missing .eslintrc-auto-import.json
- **UI Fix**: Correct serverName prop in ServerDetail for ToolCallDialog
- **Hub Tools Refactor**: Simplify dynamic resources list to only server metadata

## 2026-03-09

- **Core Refactor**: Update core modules for session and client migration
- **Gateway Refactor**: Clean up deprecated methods and update tool cache access
- **Client Refactor**: Remove deprecated client tracking and stores
- **Session Refactor**: Migrate from mcp-session-manager to session-tracker service
- **Test**: Enable initialized notification test
- **Style**: Improve regex formatting for caller info
- **Session Feature**: Add capabilities support in session manager
- **Session Refactor**: Simplify sessionId generation
- **Gateway Feature**: Add initialized notification and capabilities handling
- **Client Tracker Feature**: Add capabilities and project inference
- **Session Feature**: Add capabilities field to session model
- **UI Feature**: Add capabilities display in SessionsView
- **Logger Feature**: Add caller information and environment variable controls
- **Logger Fix**: Ensure JSON pretty-printing for empty capabilities messages
- **API Refactor**: Make MCP communication debug logging conditional
- **Feature**: Add headers support and default to streamable-http
- **UI Fix**: Fix environment variable value input display

## 2026-03-06

- **System Tool Fix**: Fix system tool call validation errors when requestOptions.sessionId is null
- **Frontend Fix**: Change system tool serverName from 'system' to 'mcp-hub-lite' for consistency
- **Zod Schema Enhancement**: Enhance sessionId schema to accept null and transform to undefined
- **ToolCallDialog Improvement**: Only include requestOptions when selectedInstanceId has value
- **Version Bump**: Update package.json version to 1.0.1

## 2026-03-05

- **Project Initialization**: Execute full project documentation architecture initialization and update
- **Root CLAUDE.md Update**: Add 2026-03-05 changelog entry, verify module structure diagram and navigation link integrity
- **Module Documentation Status Check**: Confirm CLAUDE.md document status for all 20 major modules
- **Coverage Report Verification**: Verify project scan coverage and scan status

## 2026-03-04

- **CLI Fix**: Ensure CLI commands exit properly after execution
- **CLI/Logger Fix**: Fix server startup and log ANSI color issues
- **CLI Enhancement**: Enhance status command with formatted output
- **UI Enhancement**: Improve settings page UI and dev mode handling
- **Logging Refactor**: Improve MCP gateway logging
- **Logging Refactor**: Unify dev mode detection, remove devLogFile config
- **Logging Enhancement**: Enhance stdio transport with log store integration

## 2026-03-03

- **Test Update**: Update tests for new log config system
- **Logging Fix**: Use getMcpCommDebugSetting() in connection-manager
- **Logging Refactor**: Unify logging configuration system
- **Config Enhancement**: Extend config schema with new log options
- **UI Enhancement**: Add new logging config options in settings
- **Logging Refactor**: Extract and unify MCP notification message handling
- **Logging Fix**: Improve stderr log level detection logic
- **Logging Refactor**: Use MCP_COMM_DEBUG environment variable for communication logs
- **Gateway Refactor**: Remove SSE connection timestamp tracking
- **Session Enhancement**: Count expired sessions and use configured flush interval
- **Logging Enhancement**: Filter binary image data in MCP response logs
- **UI Styling**: Remove trailing semicolon in SettingsView style
- **Refactor**: Improve type handling and SSE logging
- **Documentation**: Update project documentation
- **UI Refactor**: Implement Element Plus auto-import
- **UI Fix**: Fix el-input-number width issue in SettingsView

## 2026-03-02

- **Session Enhancement**: Skip expired sessions during recovery
- **Telemetry Removal**: Remove OpenTelemetry and telemetry features
- **Styling**: Format codebase with prettier
- **SSE Enhancement**: Add connection timeout config and reconnection detection
- **Logging Enhancement**: Enhance JSON pretty-printing with newline handling
- **Logging Styling**: Unify LOG_MODULES format as PascalCase
- **Session Refactor**: Simplify session matching logic

## 2026-03-01

- **Logging Refactor**: Change log file naming to timestamp-based format
- **Refactor**: Add LOG_MODULES context and update hub-manager service tests
- **Session Enhancement**: Enhance sessionId extraction with header support and improved fallback logic
- **Session Refactor**: Extract session manager to modular structure
- **Connection Refactor**: Extract connection manager to modular structure

## 2026-02-28

- **Documentation**: Update CLAUDE.md with project initialization summary
- **Logging Refactor**: Rename subModule to module, add LOG_MODULES constants
- **Hub-Tools Refactor**: Extract hub-tools.service.ts to modular structure
- **Gateway Refactor**: Extract gateway.service.ts to modular structure
- **API/MCP Refactor**: Extract gateway module to separate files
- **Config Refactor**: Split config-manager to modular structure
- **Logging Refactor**: Add missing subModule context to log statements
- **Logging Refactor**: Split monolithic logger to modular structure
- **Gateway Fix**: Add missing uri field in ReadMcpResourceTool response

## 2026-02-27

- **Gateway Refactor**: Enhance SSE stream management and response logging
- **Refactor**: Remove duplicate debug logging in gateway
- **Refactor**: Resolve config-logger circular dependency with config getter pattern
- **Logging Fix**: Use stringifyForLogging for gateway header, improve rawHeaders readability

## 2026-02-26

- **Refactor**: Fix ESM imports and optimize CLI startup performance
- **Frontend Enhancement**: Add type safety for JsonSchema in frontend ToolsView
- **Documentation**: Update docs for config path and logging
- **Enhancement**: Enhance dev server startup logging
- **Refactor**: Optimize logging verbosity
- **Enhancement**: Add rawHeaders operation for session header propagation
- **Enhancement**: Enhance session persistence and cleanup logic
- **Enhancement**: Introduce unified system tools processor and prefix tool name support
- **Enhancement**: Enhance session management with consistency check and request header handling
- **Refactor**: Optimize logger options extraction
- **Enhancement**: Improve tool call dialog and system tools display

## 2026-02-25

- **Enhancement**: Enhance documentation and system configuration
- **MCP Connection Manager Refactor**: Optimize getTools/getResources logging with cache hit indicator and resource cache improvements
- **Refactor**: Extract common stderr handling logic to reduce code duplication
- **Enhancement**: Add server description field and resource detail improvements

## 2026-02-15

- **Session Persistence Feature**: Implement session state persistence to disk with dirty tracking and batch flushing
- **Graceful Shutdown Handling**: Add graceful shutdown handler for session state flushing
- **Session Management API**: Add session management API endpoints (list, get, delete)
- **Session Recovery Logic**: Enhance session recovery logic with clientName matching
- **Settings Page Enhancement**: Add time unit selector (seconds/minutes/hours/days)
- **Logging System Improvements**: Support subModule context and tools/list response simplification
- **Log Directory Optimization**: Move log directory to ~/.mcp-hub-lite/logs
- **Full Check Command**: Add `npm run full:check` command for simplified complete project checking
- **Unit Test Coverage**: Add comprehensive unit tests for session manager

## 2026-02-14

- **Session Persistence Implementation**: Implement session persistence and configuration management
- **CLI Unit Tests**: Add comprehensive unit tests for CLI commands
- **Session Timeout Configuration**: Add configurable session timeout for MCP gateway
- **Type Safety Improvements**: Comprehensive eslint no-explicit-any fixes and type safety enhancements

## 2026-02-13

- **CLI Command Tests**: Add comprehensive unit tests for CLI commands
- **Session Timeout Configuration**: Add configurable session timeout for MCP gateway
- **Type Safety Fixes**: Comprehensive eslint no-explicit-any fixes and type safety improvements

## 2026-02-11

- **Frontend i18n Support**: Update server status tags and tool call dialog components with i18n support
- **ESLint Configuration Fix**: Fix lint:log command and ESLint configuration
- **Frontend Resource View**: Improve resource view with table layout
- **Type System Refactor**: Establish shared type system for frontend-backend integration
- **WebSocket Types**: Establish client and WebSocket type system
- **Config Manager Optimization**: Prevent test pollution with lazy initialization for ConfigManager
- **System Tools Optimization**: Enhance system tools type safety and naming
- **MCP Resource Support**: Add MCP resource support with UI and API endpoints
- **Client Tracking Enhancement**: Enhance client tracking and connection management
- **Tool Call Dialog**: Improve tool call dialog with i18n and response display
- **Search Functionality Optimization**: Implement comprehensive search functionality across MCP servers

## 2026-02-10

- **Fix config.test.ts Intermittent Test Failure**: Resolve "should save config to file" intermittent test failure
- **Root Cause Analysis**: ConfigManager singleton pattern caused test state pollution and temporary file path conflicts
- **Fix Solution**:
  - Modify getConfigManager() to create new instances in test environment for isolation
  - Generate unique temporary file paths for each test with timestamp and random suffix
  - Enhance file cleanup logic with retry mechanism to handle Windows file system permissions
- **Validation Results**: 100 sequential tests, 50 parallel tests (2 concurrency), 200 parallel tests (5 concurrency) all passed
- **Documentation**: Add A3 problem analysis report and detailed technical fix report

## 2026-01-31

- **Frontend UI Enhancement**: Enhance server card and interaction
- **Configuration Backup Optimization**: Optimize backup system with caching and compilation phase handling
- **Tool Call Dialog**: Enhance tool call dialog with i18n and response display
- **System Tools Simplification**: Simplify system tools API and improve type safety
- **MCP Connection Optimization**: Optimize connection management logic
- **Path Alias System**: Enhance path alias system with module-specific aliases
- **Server Status Tags**: Add server status tags component with i18n support
- **Search Functionality Optimization**: Implement comprehensive search functionality across MCP servers

## 2026-01-30

- **Config Manager Optimization**: Optimize backup logic and implement lazy initialization
- **Test Coverage Optimization**: Add temporary directory to test coverage paths
- **Logging System Refactor**: Extract common log method to eliminate code duplication
- **Test Fix**: Fix missing logger.setLevel method and system.logging property mock configuration in runner.test.ts
- **PID Formatting Optimization**: Increase PID formatting width to 8 characters
- **TypeScript Fix**: Resolve TypeScript type errors in unit tests
- **Server Optimization**: Optimize batch import with single save and concurrent startup
- **Configuration Optimization**: Skip backup creation for default configuration

## 2026-01-27

- **Server Fix**: Fix auto-start not working and sidebar display issues
- **Temporary File Cleanup**: Remove temporary files
- **Frontend Layout Refactor**: Update App.vue with new layout structure
- **Dependency Update**: Update package dependencies and Vite configuration
- **Test Updates**: Update tests for new features and services
- **Server Runtime Optimization**: Optimize server runtime and CLI commands
- **Service Enhancement**: Add Hub Manager and Search Core services
- **API Enhancement**: Enhance MCP gateway and web API endpoints
- **Frontend Features**: Add tool calls store and WebSocket utilities
- **Multi-language Support**: Add multi-language support and update UI components

## 2026-01-26

- **WebSocket Functionality**: Implement real-time log streaming via WebSocket
- **Client Management**: Add client management functionality
- **Branch Merge**: Merge branch 'feat/client-management' into 003-DEV

## 2026-01-21

- **Logging Optimization**: Optimize logging for tools/list responses
- **Client Management**: Add client management functionality

## 2026-02-01

- **Project Summary Update**: Execute "root-level concise + module-level detailed" hybrid strategy update
- **File Statistics**: Identify complete project structure and modules
- **Module Coverage**: All major modules have been identified and CLAUDE.md documents created/updated
- **Coverage Rate**: 100% module coverage, complete file scanning finished
- **Enhance Module Structure Diagram**: Update Mermaid structure diagram, ensure all module links are correct
- **Update Module Index**: Include all submodules

### 2026-01-29

- **Project Index Update**: Execute complete scan, update project documentation index
- **File Statistics**: Identify 94 source code files (47 backend + 27 frontend + 20 tests)
- **Module Coverage**: All 16 modules have been identified and CLAUDE.md documents created
- **Coverage Rate**: 100% module coverage, 100% file scanning completed
- **Enhance Module Structure Diagram**: Add missing module links (including CONTRACT module)
- **Update Module Index**: Include all submodules

### 2026-01-28

- Update summary
- Improve module structure diagram, add missing module links (including CONTRACT module)
- Create detailed CLAUDE.md documents for src/server and src/pid modules
- Create detailed CLAUDE.md documents for frontend/router and frontend/i18n modules
- Create detailed CLAUDE.md documents for tests/contract module
- Update module index, include all submodules
- **Add Frontend Test Coverage**: Add unit tests for Dashboard component, ToolCard component, and Server Store
- **Update Test Configuration**: Configure Vue Test Utils and JSDOM environment for frontend component testing
- **Update Project Documentation**: Reflect improvements in frontend test status
- **Add Server Runtime Tests**: Add complete unit test coverage for src/server/runner.ts
- **Update Test Documentation**: Add server module test documentation in tests/unit/CLAUDE.md

### 2026-01-20

- Optimize HubTools call logic, replace serverName parameter with serverId in all methods, directly use server unique identifier for operations, avoiding the overhead of finding servers by name
- Add HubToolsService documentation
- Update project architecture documentation

### 2026-01-19

- Initialize project AI context documentation
- Generate module structure diagram and index
- Integrate architecture specifications and development processes
