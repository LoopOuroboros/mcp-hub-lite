import fs from 'fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const FALLBACK_VERSION = '0.0.0';
const MCP_PROTOCOL_VERSION = '2024-11-05';

let cachedAppVersion: string | undefined;

/**
 * Resolve package version from package.json with multiple fallback paths.
 */
function resolvePackageVersion(): string {
  const baseDirs = [
    process.cwd(),
    path.dirname(fileURLToPath(import.meta.url)),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
  ];

  for (const baseDir of baseDirs) {
    let currentDir = baseDir;
    for (let depth = 0; depth < 6; depth += 1) {
      const candidate = path.join(currentDir, 'package.json');
      try {
        if (fs.existsSync(candidate)) {
          const packageText = fs.readFileSync(candidate, 'utf-8');
          const parsed = JSON.parse(packageText) as { version?: string };
          if (parsed.version && typeof parsed.version === 'string') {
            return parsed.version;
          }
        }
      } catch {
        // Ignore parsing/file read errors and continue searching.
      }

      const parent = path.dirname(currentDir);
      if (parent === currentDir) {
        break;
      }
      currentDir = parent;
    }
  }

  return FALLBACK_VERSION;
}

/**
 * Get the application version from package.json.
 *
 * @returns The package version string or a safe fallback on failure.
 */
export function getAppVersion(): string {
  if (!cachedAppVersion) {
    cachedAppVersion = resolvePackageVersion();
  }

  return cachedAppVersion;
}

/**
 * Get the MCP protocol version used by the gateway.
 */
export function getProtocolVersion(): string {
  return MCP_PROTOCOL_VERSION;
}
