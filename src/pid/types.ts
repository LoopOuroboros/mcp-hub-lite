/**
 * PID management related type definitions
 */

export interface PidInfo {
  pid: number;
  timestamp: number;
  port?: number;
}

export interface PidFileOptions {
  configDir?: string;
  filename?: string;
}
