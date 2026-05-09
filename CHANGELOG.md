# Changelog

All notable changes to this project will be documented in this file.

## [1.2.8] - 2026-05-09

### Gateway

- prevent concurrent request counter drift from SSE timeout causing 503 for new clients
- add GET /health/connections diagnostic endpoint for connection stats

## [1.2.7] - 2026-05-09

### Gateway

- add OAuth browser authentication for Streamable HTTP servers
- complete SERVER*INSTANCE*\* event pipeline with granular local WebSocket updates

### Security

- enforce allowedNetworks, connection limits, and timeout at runtime

### Core

- auto-increment port when occupied in dev mode
- improve MCP server startup failure log visibility
- remove dead code and unused types

---

## [1.2.6] - 2026-04-29

### Hub Tools

- use runtime connected status for instance selection
- clarify instance filtering comment
- fix listMcpResources returning incomplete server resources by using two-pass approach to check all instances connection status

### Utils

- add null check to normalizeToolName

---

## [1.2.5] - 2026-04-28

### Hub Tools

- enhance hub-tools system with improved tool handling
- add list_tags tool constants and update CLAUDE.md docs
- add comprehensive use guide documentation
- improve default server description text
- remove stale cache in listResources
- clarify instance filtering comment
- fix listMcpResources returning incomplete server resources by using two-pass approach to check all instances connection status
- align resource generation logic with /web/mcp/status API behavior

### Utils

- add null check to normalizeToolName

---

## [1.2.4] - 2026-04-25

### Frontend

- Shorten long server version display with tooltip for full version

### Hub Tools

- Improve error message when attempting to update gateway server

### Docs

- Add "解决痛点" section to Chinese README
- Add LinuxDo topic link to Chinese README

---

## [1.2.3] - 2026-04-20

### CLI

- Add use-guide command for CLI usage reference
- Add install command for adding new MCP servers
- Remove redundant npm scripts

### Gateway

- Wrap initialize handler debug logs with gatewayDebug condition

### Docs

- Reorganize changelog by functional areas

---

## [1.2.2] - 2026-04-17

### Gateway

- Add gatewayDebug logging control

### Frontend

- Add time unit types and conversion utilities
- Add Startup configuration tab to Settings page

### Config

- Correct servers sorting in config-loader

### Startup

- Extract ensureServerInstances() to eliminate DRY violation
- Extract startup orchestration logic into dedicated module

### Resources

- Ensure consistent { contents: [...] } format in resource read API

### Logging

- Add STDERR log module for stdio transport

### Connection

- Split connect() into SRP-compliant private methods

### Other

- Update changelog for 2026-04-15 to 2026-04-17
- Add LinuxDo community acknowledgment

---

## [1.2.0] - 2026-04-14

### Core

- Add normalizeToolName for cross-format tool name matching

### CLI

- Add tool-use command for MCP server tool operations
- Fix CLI entry detection for Windows/npm symlink environments
- Fix command count and rename mcpToolUseCommand to toolUseCommand

### Config

- Change config loading logs from info to debug level

### System Tools

- Rename list_tools_in_server to list_tools

### Documentation

- Complete CLAUDE.md documentation for all submodules
- Update changelog and README for v1.2 release

### Utils

- Add unit tests for normalizeToolName function

---

## [1.1.1] - 2026-04-14

### Gateway

- Implement per-request transport mode to fix connection errors

### Frontend

- Prevent runtime error when tool is undefined in groupedTools

---

## [1.1.0] - 2026-04-13

### Resources

- Implement MCP native resource forwarding

### Gateway

- Restrict call_tool from invoking system tools
- Return 400 for missing Accept header
- Extract version and protocol version to shared utility
- Only include tools from servers with allowedTools configured

### Security

- Mask sensitive values in config change logs

### Config

- Sort env and headers keys on config save
- Implement v1.1 instance configuration system
- Enhance instance management with display name and route selection
- Add empty value cleaning when saving config
- Add index and displayName to ServerInstanceConfig with reassignment API
- Add v1.1 config schema with auto-migration support
- Move instance selection strategy to template
- Complete v1.1 multi-instance configuration refactoring
- Activate v1.1 config format with instance support
- Activate v1.1 config format, remove v1.0 compatibility code
- Ensure server instance indexes from config load and migration
- Support string index type for server instance operations
- Unify instance ID generation with content hash

### Proxy

- Add proxy configuration support for SSE and Streamable HTTP transports

### Transport

- Add LineBuffer for proper stderr line buffering
- Use official SDK StdioClientTransport
- Log non-JSON-RPC stdout and unify stderr log level

### Frontend

- Add instance tab routing synchronization
- Fix tools and resources not displaying in server detail
- Add description field to ConfigTemplateForm
- Improve instance status reactivity and management
- Add bottom padding to prevent save button cutoff on scroll
- Fix TypeScript type errors in component event handlers
- Ensure log viewer area fills available container height
- Optimize instance list display in English and hide redundant Running tag
- Correct dark mode background color and refine instance UI
- Improve type declarations and test type safety
- Compute instance counts from server.instances directly

### UI Components

- Add server instance management UI components
- Add tag management UI with TagManager component
- Add description field support in AddServerModal
- Update resource detail and list views with hub tools integration

### i18n

- Improve noToolsFound message to reflect tool aggregation
- Correct missing translation key in InstanceConfig component
- Fix headers label and add button text in server config

### Session

- Remove cwd and project fields from session management
- Remove session persistence mechanism and use SDK native stateless mode
- Remove session persistence mechanism

### System Tools

- Implement instance selection strategies
- Add update_server_description system tool
- Support both toolArgs and arguments for backward compatibility
- Add MCP_HUB_LITE_SERVER handling to getTool
- listServers only returns connected servers
- Restructure core hub tools service architecture
- Enhance system tools handling and API endpoints
- Add non-strict mode to selectBestInstance
- Optimize hub tools service and API
- Simplify system tools API and improve type safety

### MCP Status

- Prevent automatic enabled field updates on connect/disconnect

### Connection

- Improve serverId handling and protocol version support

### Search

- Remove complex search module, simplify to string matching
- Simplify search logic using server-level caching

### Tests

- Remove evaluation tests not compliant with MCP spec

### Core

- Use composite key serverName-serverIndex instead of serverId

### Documentation

- Update search functionality description
- Update CLAUDE.md documentation for logging and composables
- Update CLAUDE.md documentation for v1.1 config refactor
- Update CLAUDE.md files to reflect session removal
- Update CLAUDE.md files across project modules
- Update CLAUDE.md files to reflect recent v1.1 config changes
- Update CLAUDE.md files with format improvements and new content

### Use Guide

- Compress use-guide from 13 to 7 sections

### Tools

- Handle nested toolArgs in updateServerDescription
- Simplify ServerStatusTags tests with mocks
- Optimize updateServerInstance logging

### Lint

- Add fallback for missing .eslintrc-auto-import.json

### Status

- Show all configured servers including disabled ones in status

---

## [1.0.2] - 2026-03-15

### Session

- Add capabilities support in session manager
- Add capabilities field to session model
- Simplify sessionId generation

### Gateway

- Add initialized notification and capabilities handling
- Clean up deprecated methods and update tool cache access
- Enable initialized notification test

### Client

- Add capabilities and project inference

### UI

- Add capabilities display in SessionsView
- Correct serverName prop in ServerDetail for ToolCallDialog

### System Tools

- Simplify dynamic resources list to only server metadata

### Core

- Update core modules for session and client migration

### Client Tracking

- Remove deprecated client tracking and stores

### Session Migration

- Migrate from mcp-session-manager to session-tracker service

### API

- Make MCP communication debug logging conditional

---

## [1.0.1] - 2026-03-15

### UI

- Fix environment variable value input display

### System Tools

- Resolve system tool call validation errors

---

## [1.0.0] - 2026-03-15

### UI

- Improve dashboard and server status tags
- Improve settings page UI and dev mode handling
- Add new logging configuration options to settings
- Improve resources view with table layout
- Improve tool call dialog and system tools display
- Enhance server card and interaction
- Enhance tool call dialog with i18n and response display
- Add server status tags component with i18n support
- Update App.vue with new layout structure

### CLI

- Enhance status command with formatted output
- Add comprehensive unit tests for CLI commands
- Ensure CLI commands exit properly after execution
- Fix server startup and log ANSI color issues

### Logging

- Enhance log storage integration for stdio transports
- Filter binary image data in MCP response logs
- Enhance JSON pretty printing with newline processing
- Improve MCP gateway logging
- Unify dev mode detection and remove devLogFile config
- Unify logging configuration system
- Extract and unify MCP notification message handling
- Use MCP_COMM_DEBUG env var to control communication logs
- Change log file naming to timestamp-based format
- Add missing subModule context to log statements
- Split monolithic logger into modular structure
- Enhance SSE stream management and response logging
- Extract common log method to eliminate code duplication
- Optimize logging verbosity
- Optimize logger options extraction
- Optimize getTools/getResources logging with cache hit indicators and resource cache improvement
- Improve stderr log level detection logic
- Use getMcpCommDebugSetting() in connection-manager
- Use stringifyForLogging for gateway headers and improve rawHeaders readability
- Enhance development server logging and hot reload
- Organize file structure and enhance logging
- Optimize logging for tools/list responses
- Update documentation for config path and logging

### Config

- Extend config schema with new logging options
- Add configurable session timeout for MCP gateway
- Simplify config-manager implementation
- Use default config on validation failure
- Prevent auto-creation of config file and add error logging
- Add immediate save option to updateConfig method
- Optimize backup system with caching and compilation phase handling
- Optimize backup logic and implement lazy initialization
- Skip backup creation for default config
- Remove delayed save mechanism
- Correct config path

### Session

- Count expired sessions and use config flush interval
- Skip expired sessions during restore
- Enhance sessionId extraction with header support and improved fallback logic
- Enhance session persistence and cleanup logic
- Enhance session management with consistency checks and request header handling
- Implement comprehensive session persistence and management
- Implement session persistence and configuration management
- Simplify session matching logic
- Extract session manager into modular structure

### SSE

- Add connection timeout config and reconnection detection
- Remove SSE connection timestamp tracking
- Improve type handling and SSE logging

### Type System

- Add type safety for JsonSchema in frontend ToolsView
- Comprehensive eslint no-explicit-any fixes and type safety improvements
- Establish shared type system for frontend-backend integration

### System Tools

- Introduce unified system tool handler and prefixed tool name support
- Implement system tools framework with centralized constants

### Documentation

- Enhance documentation and system configuration
- Add server description field and resource detail improvements
- Update project documentation and configuration

### Request Headers

- Add rawHeaders manipulation for session header propagation

### Tools

- Add serverName field to tool model and implement server-level caching

### Observability

- Enhance OpenTelemetry integration and logging system
- Add OpenTelemetry tracing support
- Simplify tracing exporters to console and OTLP only
- Remove OpenTelemetry and telemetry functionality

### Logger

- Add subModule support to logger and update WebSocket logs
- Add LOG_MODULES context and update hub-manager service tests

### Search

- Implement simple search service for basic tool discovery
- Enhance tool call dialog and tools view with search integration
- Implement comprehensive search functionality across MCP servers

### WebSocket

- Add server update event listeners

### Tool Views

- Enhance tools view with serverName-based grouping
- Enhance tool call dialog and tools view with search integration

### Batch Operations

- Optimize batch import with single save and concurrent startup

### Services

- Add hub manager and search core services

### API

- Enhance MCP gateway and web API endpoints

### Client Tracking

- Enhance client tracking and connection management

### Frontend Store

- Add tool calls store and websocket utilities

### Client

- Add client version display
- Add manual save button to server list
- Add client management functionality

### i18n

- Add multi-language support and update UI components
- Add internationalization support for server management actions

### Server Management

- Enhance system configuration management and server management functionality
- Enhance server management functionality, add timeout and auto-start configurations
- Optimize server detail page status display and uptime calculation

### Tool Management

- Implement comprehensive tool search and management system

### Tool Gateway

- Implement Tools Gateway and refactor navigation

### MCP Server

- Add server auto-start configuration and refactor MCP gateway transport
- Add server version information display functionality
- Implement MCP Server log page to display complete logs
- Add server config timeout setting functionality
- Refactor MCP connection management and transport layer, add resource model support
- Fix auto-start not working and sidebar display issues

### Resources

- Display tool and resource counts in tabs
- Add MCP resources support with UI and API endpoints

### Transport

- Add Streamable HTTP transport support for Microsoft Learn MCP Server

### Frontend Tools

- Add remote server support and HTTP utilities
- Save development progress with UI enhancements and new components
- Complete frontend architecture refactoring and implement new UI components
- Use shared types in frontend code
- Enhance path alias system with module-specific aliases
- Rename dashboard and header components to view suffix
- Frontend code cleanup and improvements
- Enhance type safety in gateway and hub tools services

### Implementation Milestones

- Complete MCP Hub Lite implementation with multi-server support
- Simplify architecture and enhance CLI status command
- Enhance CLI, add i18n, update config & cleanup
- Implement pid management and stop/restart commands
- Implement cli commands (start, list, status, ui)
- Implement fault tolerance and health checks
- Implement mcp streaming gateway with stdio support
- Implement mcp connection and tool search
- Complete phase 3 server management implementation
- Complete Phase 1 & 2 (infrastructure, models, config)

### Tests

- Resolve config manager intermittent test failure
- Prevent test pollution by implementing lazy initialization for ConfigManager
- Resolve TypeScript type errors in unit tests
- Fix runner.test.ts missing logger.setLevel method and system.logging mock config
- Update all tests to include serverName field
- Add comprehensive utility unit tests
- Add comprehensive server runner unit tests
- Add comprehensive frontend and backend test infrastructure
- Fix lint:log command and ESLint configuration
- Add evaluation test files

### Element Plus

- Implement Element Plus auto-import

### Imports

- Replace relative imports with path aliases

### Vitest

- Add temp directory to test coverage paths
- Exclude frontend unit tests from main tsconfig

### Images

- Remove unused image

### Index

- Update project index and fix documentation typos
- Update project AI context documentation

### Debugging

- Remove duplicate debug logs in gateway
- Fix ESM imports and optimize CLI startup performance
- Resolve config-logger circular dependency using config getter pattern

### Bug Fixes

- Fix el-input-number width issue in SettingsView
- Add missing uri field in ReadMcpResourceTool response
- Correct serverName usage in tool call dialog
- Correct variable declaration in applyFilters
- Correct config path in SettingsView computed properties
- Ensure allowedTools is initialized as empty array for new servers
- Fix tool aggregation toggle logic in frontend
- Fix log loading issues in Dashboard and ServerDetail
- Fix two issues with server deletion functionality
- Fix CLI commands hanging after execution
- Add missing PidManager import in index.ts
- Fix missing imports in app.ts

### Backend

- Use shared types in backend code

### Architecture

- Establish shared type system for frontend-backend integration

### Type Safety

- Improve system tools type safety and naming
- Optimize configuration and logging system
- Enhance test coverage and SDK helpers
- Improve configuration and telemetry
- Optimize connection management logic
