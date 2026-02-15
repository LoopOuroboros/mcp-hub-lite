/**
 * CLI Server Management Functions
 * Handles start, stop, status, restart operations
 */

import { buildApp } from '@src/app.js';
import { PidManager } from '@pid/manager.js';
import { hubManager } from '@services/hub-manager.service.js';

interface ServerOptions {
  port: number;
  host: string;
  configPath?: string;
}

export async function startServer(options: ServerOptions) {
  const app = await buildApp();

  // Start the server
  await app.listen({ port: options.port, host: options.host });

  // Save PID
  PidManager.writePid();

  return app;
}

export async function stopServer(pid?: string) {
  const actualPid = pid || PidManager.getPid()?.toString();

  if (actualPid) {
    process.kill(parseInt(actualPid), 'SIGTERM');
    PidManager.removePid();
  }
}

export async function getServerStatus(pid?: string) {
  const actualPid = pid || PidManager.getPid()?.toString();

  if (!actualPid) {
    return { running: false, message: 'Server not running' };
  }

  try {
    process.kill(parseInt(actualPid), 0); // Signal 0 just checks if process exists
    return {
      running: true,
      pid: actualPid,
      servers: hubManager.getAllServers().length
    };
  } catch {
    return { running: false, message: 'Server process not found' };
  }
}

export async function restartServer(options: ServerOptions) {
  await stopServer();
  return await startServer(options);
}

export async function listServers() {
  const servers = hubManager.getAllServers();
  const serverInstances = hubManager.getServerInstances();

  return servers.map((server) => ({
    ...server,
    instances: serverInstances[server.name] || []
  }));
}
