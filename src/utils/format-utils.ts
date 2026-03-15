/**
 * Utility functions for formatting various data types
 */

/**
 * Format uptime duration in HH:MM:SS format
 * @param startTime - The start timestamp in milliseconds
 * @param status - The server status (only 'online' will show actual uptime)
 * @returns Formatted uptime string in HH:MM:SS format
 */
export function formatUptime(startTime?: number, status?: string): string {
  if (!startTime || status !== 'online') {
    return '00:00:00';
  }

  const diff = Math.floor((Date.now() - startTime) / 1000);
  if (diff < 0) {
    return '00:00:00';
  }

  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format duration in human-readable format (d/h/m/s)
 * @param milliseconds - Duration in milliseconds
 * @returns Formatted duration string (e.g., "2d 3h 45m", "1h 30m", "45m", "30s")
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours % 24 > 0) {
    parts.push(`${hours % 24}h`);
  }
  if (minutes % 60 > 0) {
    parts.push(`${minutes % 60}m`);
  }
  if (seconds % 60 > 0 && parts.length === 0) {
    parts.push(`${seconds % 60}s`);
  }

  return parts.length > 0 ? parts.join(' ') : '0s';
}

/**
 * Get executable name from command path
 * @param cmd - The command path or name
 * @returns The executable name (last part of path)
 */
export function getExecutableName(cmd?: string): string {
  if (!cmd) return 'unknown';
  // Only show the last part of path or just the command
  return cmd.split(/[/\\]/).pop() || cmd;
}
