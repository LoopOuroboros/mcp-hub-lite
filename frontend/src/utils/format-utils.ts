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
 * Get executable name from command path
 * @param cmd - The command path or name
 * @returns The executable name (last part of path)
 */
export function getExecutableName(cmd?: string): string {
  if (!cmd) return 'unknown';
  // Only show the last part of path or just the command
  return cmd.split(/[/\\]/).pop() || cmd;
}

/**
 * Format timestamp to human-readable string with date and time
 * @param timestamp - The timestamp in milliseconds
 * @returns Formatted timestamp string in YYYY-MM-DD HH:mm:ss.SSS format
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

/**
 * Format timestamp to time-only string
 * @param timestamp - The timestamp in milliseconds
 * @returns Formatted time string in HH:mm:ss.SSS format
 */
export function formatTimeOnly(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}
