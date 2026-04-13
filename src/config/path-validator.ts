/**
 * Path validation utilities for configuration files.
 * Provides basic path validation to prevent path traversal attacks.
 */

import { resolve, normalize } from 'node:path';

/**
 * Validates that a path is within an allowed directory.
 *
 * @param configPath - The path to validate
 * @param allowedDirs - Array of allowed parent directories
 * @returns true if path is valid, false otherwise
 */
export function isValidConfigPath(configPath: string, allowedDirs: string[]): boolean {
  try {
    const normalizedPath = normalize(resolve(configPath));

    for (const allowedDir of allowedDirs) {
      const normalizedAllowedDir = normalize(resolve(allowedDir));
      if (normalizedPath.startsWith(normalizedAllowedDir)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Ensures a path is absolute and normalized.
 *
 * @param configPath - The path to sanitize
 * @returns Normalized absolute path
 */
export function sanitizeConfigPath(configPath: string): string {
  return normalize(resolve(configPath));
}

/**
 * Validates that a filename doesn't contain path traversal characters.
 *
 * @param filename - The filename to validate
 * @returns true if filename is safe, false otherwise
 */
export function isSafeFilename(filename: string): boolean {
  // Block path traversal patterns
  if (filename.includes('..')) return false;
  if (filename.includes('/') || filename.includes('\\')) return false;

  // Block null bytes
  if (filename.includes('\0')) return false;

  return true;
}
