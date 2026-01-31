/**
 * Utility functions for formatting various data types
 */

/**
 * Format uptime duration in HH:MM:SS format
 * @param startTime - The start timestamp in milliseconds
 * @param status - The server status (only 'running' will show actual uptime)
 * @returns Formatted uptime string in HH:MM:SS format
 */
export function formatUptime(startTime?: number, status?: string): string {
  if (!startTime || status !== 'running') {
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
 * Get executable name from command path
 * @param cmd - The command path or name
 * @returns The executable name (last part of path)
 */
export function getExecutableName(cmd?: string): string {
  if (!cmd) return 'unknown';
  // Only show the last part of path or just the command
  return cmd.split(/[/\\]/).pop() || cmd;
}