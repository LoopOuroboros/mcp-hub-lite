/**
 * Port occupancy checker utility
 * Checks if a port is in use and attempts to identify the occupying process
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { PidManager } from '@pid/manager.js';

const execAsync = promisify(exec);

export interface PortCheckResult {
  inUse: boolean;
  pid?: number;
  processName?: string;
  commandLine?: string;
  isSelfProject?: boolean;
}

/**
 * Check if port is in use
 */
export async function checkPort(port: number): Promise<PortCheckResult> {
  try {
    const platform = process.platform;

    if (platform === 'win32') {
      return await checkPortWindows(port);
    } else {
      return await checkPortUnix(port);
    }
  } catch {
    // Return not in use on check failure (safe default)
    return { inUse: false };
  }
}

/**
 * Windows platform port check
 */
async function checkPortWindows(port: number): Promise<PortCheckResult> {
  try {
    // Use netstat to find the process occupying the port
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);

    if (!stdout.trim()) {
      return { inUse: false };
    }

    // Parse netstat output to extract PID
    const lines = stdout.trim().split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const localAddress = parts[1];
      const state = parts[3];
      const pid = parseInt(parts[4], 10);

      // Check if it's in LISTENING state and is the target port
      if (state === 'LISTENING' && localAddress.endsWith(`:${port}`)) {
        // Get process details
        const processInfo = await getProcessInfoWindows(pid);

        // Check if it's the current project's process
        const isSelfProject = await isSelfProjectProcess(pid, processInfo.commandLine);

        return {
          inUse: true,
          pid,
          processName: processInfo.processName,
          commandLine: processInfo.commandLine,
          isSelfProject
        };
      }
    }

    return { inUse: false };
  } catch {
    return { inUse: false };
  }
}

/**
 * Unix platform port check (Linux, macOS)
 */
async function checkPortUnix(port: number): Promise<PortCheckResult> {
  try {
    // Use lsof to find the process occupying the port
    const { stdout } = await execAsync(`lsof -i :${port} -sTCP:LISTEN -t`);

    if (!stdout.trim()) {
      return { inUse: false };
    }

    const pid = parseInt(stdout.trim().split('\n')[0], 10);

    // Get process details
    const processInfo = await getProcessInfoUnix(pid);

    // Check if it's the current project's process
    const isSelfProject = await isSelfProjectProcess(pid, processInfo.commandLine);

    return {
      inUse: true,
      pid,
      processName: processInfo.processName,
      commandLine: processInfo.commandLine,
      isSelfProject
    };
  } catch {
    return { inUse: false };
  }
}

/**
 * Get Windows process information
 */
async function getProcessInfoWindows(
  pid: number
): Promise<{ processName: string; commandLine: string }> {
  try {
    // Use wmic to get process details
    const { stdout } = await execAsync(
      `wmic process where ProcessId=${pid} get Name,CommandLine /format:list`
    );

    const lines = stdout.split('\n').filter((line) => line.trim());
    let processName = 'Unknown';
    let commandLine = '';

    for (const line of lines) {
      if (line.startsWith('CommandLine=')) {
        commandLine = line.substring('CommandLine='.length).trim();
      } else if (line.startsWith('Name=')) {
        processName = line.substring('Name='.length).trim();
      }
    }

    return { processName, commandLine };
  } catch {
    return { processName: 'Unknown', commandLine: '' };
  }
}

/**
 * Get Unix process information
 */
async function getProcessInfoUnix(
  pid: number
): Promise<{ processName: string; commandLine: string }> {
  try {
    // Use ps to get process details
    const { stdout } = await execAsync(`ps -p ${pid} -o comm=,args=`);

    const parts = stdout.trim().split(/\s+/);
    const processName = parts[0] || 'Unknown';
    const commandLine = stdout.trim();

    return { processName, commandLine };
  } catch {
    return { processName: 'Unknown', commandLine: '' };
  }
}

/**
 * Determine if it's a process started by the current project
 */
async function isSelfProjectProcess(pid: number, commandLine: string): Promise<boolean> {
  // Check 1: Check if the PID recorded in the PID file matches
  const savedPid = PidManager.getPid();
  if (savedPid === pid) {
    return true;
  }

  // Check 2: Check if the command line contains project signatures
  if (!commandLine) {
    return false;
  }

  const projectSignatures = [
    'mcp-hub-lite', // Project name
    'dist/server/src/index.js', // Compiled entry file
    'src/index.ts' // Source code entry file
  ];

  return projectSignatures.some((signature) => commandLine.includes(signature));
}
