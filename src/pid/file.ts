/**
 * PID file operation utilities
 * Responsibility: Low-level PID file read/write/delete operations
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import type { PidFileOptions } from './types.js';

// Config directory: Prefer using .mcp-hub-lite/config folder in user's home directory
const DEFAULT_CONFIG_DIR = path.join(os.homedir(), '.mcp-hub-lite', 'config');
const DEFAULT_PID_FILENAME = '.mcp-hub.pid';

/**
 * Get PID file path
 */
export function getPidFilePath(options?: PidFileOptions): string {
  const configDir = options?.configDir || DEFAULT_CONFIG_DIR;
  const filename = options?.filename || DEFAULT_PID_FILENAME;
  return path.join(configDir, filename);
}

/**
 * Write PID file
 */
export function writePidFile(pid: number, options?: PidFileOptions): void {
  const filePath = getPidFilePath(options);
  const configDir = path.dirname(filePath);

  // Ensure config directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(filePath, pid.toString(), 'utf8');
}

/**
 * Read PID file
 */
export function readPidFile(options?: PidFileOptions): number | null {
  try {
    const filePath = getPidFilePath(options);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const pid = parseInt(content.trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/**
 * Remove PID file
 */
export function removePidFile(options?: PidFileOptions): void {
  try {
    const filePath = getPidFilePath(options);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Ignore deletion errors
  }
}

/**
 * Check if PID file exists
 */
export function pidFileExists(options?: PidFileOptions): boolean {
  const filePath = getPidFilePath(options);
  return fs.existsSync(filePath);
}
