/**
 * CLI argument parsing utility
 * Provides parameter validation and parsing functions
 */

import type { LogLevel } from '@shared-types/common.types.js';

export interface CliOptions {
  port?: number;
  host?: string;
  config?: string;
  foreground?: boolean;
  stdio?: boolean;
}

/**
 * Parses and validates a port number from a string input.
 *
 * This function converts a string representation of a port number to an integer
 * and validates that it falls within the valid TCP/UDP port range (1-65535).
 * It is primarily used for CLI argument parsing when users specify custom ports
 * via command line options like `--port` or `-p`.
 *
 * @param value - The string representation of the port number to parse
 * @returns The validated port number as an integer
 * @throws {Error} If the input is not a valid number or outside the valid port range (1-65535)
 *
 * @example
 * ```typescript
 * const port = parsePort("8080"); // Returns 8080
 * const invalidPort = parsePort("99999"); // Throws Error: Invalid port: 99999. Must be between 1 and 65535.
 * ```
 */
export function parsePort(value: string): number {
  const port = parseInt(value, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${value}. Must be between 1 and 65535.`);
  }
  return port;
}

/**
 * Parses and validates a hostname or IP address from a string input.
 *
 * This function performs basic validation on hostname/IP address inputs by ensuring
 * the value is not empty or whitespace-only. It trims any leading/trailing whitespace
 * from the input and returns the cleaned hostname. This function is used when parsing
 * CLI arguments for host configuration via options like `--host` or `-h`.
 *
 * Note: This function performs only basic validation (non-empty check). More complex
 * hostname format validation (e.g., DNS compliance, IP address format) should be
 * handled at the network layer or by the underlying server implementation.
 *
 * @param value - The hostname or IP address string to parse and validate
 * @returns The trimmed hostname/IP address string
 * @throws {Error} If the input is null, undefined, or contains only whitespace
 *
 * @example
 * ```typescript
 * const host = parseHost("localhost"); // Returns "localhost"
 * const hostWithSpaces = parseHost("  127.0.0.1  "); // Returns "127.0.0.1"
 * const emptyHost = parseHost(""); // Throws Error: Host cannot be empty
 * ```
 */
export function parseHost(value: string): string {
  // Simple hostname format validation
  if (!value || value.trim().length === 0) {
    throw new Error('Host cannot be empty');
  }
  return value.trim();
}

/**
 * Validates a configuration file path to ensure it points to a valid JSON file.
 *
 * This function checks that the provided file path ends with the `.json` extension,
 * ensuring that only JSON configuration files are accepted. It is used during CLI
 * argument parsing when users specify custom configuration files via the `--config`
 * option. The function does not verify file existence or accessibility, as those
 * checks should be performed by the file system operations that actually read the file.
 *
 * @param path - The file path to validate as a configuration file path
 * @returns The original path string if validation passes
 * @throws {Error} If the path does not end with the '.json' extension
 *
 * @example
 * ```typescript
 * const validPath = validateConfigPath("./config.json"); // Returns "./config.json"
 * const invalidPath = validateConfigPath("./config.txt"); // Throws Error: Config file must be a .json file
 * ```
 */
export function validateConfigPath(path: string): string {
  if (!path.endsWith('.json')) {
    throw new Error('Config file must be a .json file');
  }
  return path;
}

/**
 * Validate log level
 */
export function validateLogLevel(level: string): LogLevel {
  const validLevels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
  const lowerLevel = level.toLowerCase() as LogLevel;
  if (!validLevels.includes(lowerLevel)) {
    throw new Error(`Invalid log level: ${level}. Must be one of: ${validLevels.join(', ')}`);
  }
  return lowerLevel;
}

/**
 * Merges CLI options with default values to create a complete configuration object.
 *
 * This function takes partial CLI options (which may contain only some of the available
 * options) and merges them with a complete set of default values. It uses nullish coalescing
 * (??) to ensure that only undefined or null values are replaced with defaults, preserving
 * explicitly set falsy values like `false` for boolean options.
 *
 * The function handles all standard CLI options including:
 * - port: TCP port number for the server
 * - host: Hostname or IP address to bind to
 * - config: Path to configuration file
 * - foreground: Whether to run in foreground mode
 * - stdio: Whether to use stdio transport mode
 *
 * @param options - Partial CLI options object containing user-specified values
 * @param defaults - Complete CLI options object containing default values
 * @returns {CliOptions} A complete CLI options object with merged values
 *
 * @example
 * ```typescript
 * const userOptions = { port: 8080 };
 * const defaultOptions = { port: 7788, host: 'localhost', config: '.mcp-hub.json', foreground: false, stdio: false };
 * const merged = mergeOptions(userOptions, defaultOptions);
 * // Result: { port: 8080, host: 'localhost', config: '.mcp-hub.json', foreground: false, stdio: false }
 * ```
 */
export function mergeOptions(options: Partial<CliOptions>, defaults: CliOptions): CliOptions {
  return {
    port: options.port ?? defaults.port,
    host: options.host ?? defaults.host,
    config: options.config ?? defaults.config,
    foreground: options.foreground ?? defaults.foreground,
    stdio: options.stdio ?? defaults.stdio
  };
}
