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
 * Checks if a specific port is in use on Windows platform.
 *
 * This function uses the Windows `netstat` command to identify processes that are
 * listening on the specified port. It parses the netstat output to extract the
 * process ID (PID) and then retrieves detailed process information using WMIC.
 *
 * The function specifically looks for connections in the "LISTENING" state and
 * matches the local address to ensure it's the exact port being checked.
 *
 * @param port - The port number to check for occupancy (e.g., 7788)
 * @returns {Promise<PortCheckResult>} A promise that resolves to a PortCheckResult object
 *          containing information about whether the port is in use, the PID of the
 *          occupying process, process name, command line, and whether it's the current project
 *
 * @example
 * ```typescript
 * const result = await checkPortWindows(7788);
 * if (result.inUse) {
 *   console.log(`Port 7788 is used by PID ${result.pid} (${result.processName})`);
 * }
 * ```
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
 * Checks if a specific port is in use on Unix platforms (Linux, macOS).
 *
 * This function uses the `lsof` (list open files) command to identify processes that are
 * listening on the specified port. It filters for TCP connections in LISTEN state and
 * extracts the process ID (PID) from the output.
 *
 * After identifying the PID, it retrieves detailed process information using the `ps` command
 * to get the process name and full command line arguments.
 *
 * @param port - The port number to check for occupancy (e.g., 7788)
 * @returns {Promise<PortCheckResult>} A promise that resolves to a PortCheckResult object
 *          containing information about whether the port is in use, the PID of the
 *          occupying process, process name, command line, and whether it's the current project
 *
 * @example
 * ```typescript
 * const result = await checkPortUnix(7788);
 * if (result.inUse) {
 *   console.log(`Port 7788 is used by PID ${result.pid} (${result.processName})`);
 * }
 * ```
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
 * Retrieves detailed process information for a given PID on Windows.
 *
 * This function uses the Windows Management Instrumentation Command-line (WMIC) tool
 * to query process details including the process name and full command line arguments.
 * It parses the WMIC output to extract the relevant information and handles potential
 * errors gracefully by returning default values.
 *
 * @param pid - The process ID to query for information
 * @returns {Promise<{ processName: string; commandLine: string }>} A promise that resolves to an object
 *          containing the process name and command line arguments, or default values if the query fails
 *
 * @example
 * ```typescript
 * const info = await getProcessInfoWindows(12345);
 * console.log(`Process: ${info.processName}`);
 * console.log(`Command: ${info.commandLine}`);
 * ```
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
 * Retrieves detailed process information for a given PID on Unix platforms (Linux, macOS).
 *
 * This function uses the `ps` (process status) command to query process details including
 * the process name (comm) and full command line arguments (args). It parses the ps output
 * to extract the relevant information and handles potential errors gracefully by returning
 * default values.
 *
 * @param pid - The process ID to query for information
 * @returns {Promise<{ processName: string; commandLine: string }>} A promise that resolves to an object
 *          containing the process name and command line arguments, or default values if the query fails
 *
 * @example
 * ```typescript
 * const info = await getProcessInfoUnix(12345);
 * console.log(`Process: ${info.processName}`);
 * console.log(`Command: ${info.commandLine}`);
 * ```
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
 * Determines whether a given process belongs to the current MCP Hub Lite project.
 *
 * This function performs two checks to identify if a process is part of the current project:
 * 1. **PID File Check**: Compares the provided PID with the PID stored in the project's PID file
 * 2. **Command Line Signature Check**: Searches for project-specific signatures in the command line
 *
 * The function uses a list of project signatures including the project name 'mcp-hub-lite',
 * the compiled entry file path 'dist/server/src/index.js', and the source entry file 'src/index.ts'.
 *
 * @param pid - The process ID to check
 * @param commandLine - The full command line used to start the process
 * @returns {Promise<boolean>} A promise that resolves to true if the process belongs to the current project, false otherwise
 *
 * @example
 * ```typescript
 * const isSelf = await isSelfProjectProcess(12345, 'node dist/server/src/index.js');
 * if (isSelf) {
 *   console.log('This is our project process');
 * }
 * ```
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
