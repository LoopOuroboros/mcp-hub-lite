/**
 * Configuration saving utilities.
 * Handles persisting configuration to disk with proper directory creation.
 */

import * as fs from 'fs';
import path from 'path';

/**
 * Saves the configuration to disk at the specified path.
 *
 * This function writes the current configuration to the configured file path,
 * creating the directory structure if it doesn't exist. Errors during the save
 * operation are silently ignored to prevent crashes during normal operation.
 *
 * All empty values and empty objects are preserved as-is in the output.
 *
 * @param configPath - Path to save the configuration file
 * @param config - The configuration object to save
 */
export function saveConfig(configPath: string, config: unknown): void {
  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch {
    // Ignore
  }
}
