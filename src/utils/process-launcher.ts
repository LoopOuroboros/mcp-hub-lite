import { spawn } from 'node:child_process';
import { PassThrough, Readable } from 'node:stream';
import net from 'node:net';

export interface LaunchedProcess {
  pid: number;
  stderr: Readable;
  stop(): Promise<void>;
}

export interface LaunchConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * Pure process lifecycle manager. No MCP protocol dependency.
 * Handles spawn, ready detection, and graceful shutdown for locally-launched MCP servers.
 */
export class ProcessLauncher {
  /**
   * Launch a child process and return a handle for lifecycle management.
   */
  static launch(config: LaunchConfig): LaunchedProcess {
    const childProcess = spawn(config.command, config.args, {
      env: { ...process.env, ...(config.env || {}) },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const stderrStream = new PassThrough();
    let exited = false;

    if (childProcess.stderr) {
      childProcess.stderr.on('data', (chunk: Buffer) => {
        if (!stderrStream.writableEnded) {
          stderrStream.write(chunk);
        }
      });
    }

    childProcess.on('exit', () => {
      exited = true;
      if (!stderrStream.writableEnded) {
        stderrStream.end();
      }
    });

    childProcess.on('error', () => {
      if (!stderrStream.writableEnded) {
        stderrStream.end();
      }
    });

    const stop = (): Promise<void> => {
      if (!childProcess || exited) return Promise.resolve();

      return new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (!exited) {
            childProcess.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        childProcess.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });

        childProcess.kill('SIGTERM');
      });
    };

    return {
      pid: childProcess.pid!,
      stderr: stderrStream,
      stop
    };
  }

  /**
   * Wait for a TCP port to become available (listening).
   * Probes the port every 200ms until connection succeeds or timeout.
   */
  static waitForPort(host: string, port: number, timeout: number): Promise<void> {
    const start = Date.now();

    const probe = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (Date.now() - start >= timeout) {
          reject(new Error(`Port ${host}:${port} did not become available within ${timeout}ms`));
          return;
        }

        const socket = new net.Socket();
        socket.setTimeout(1000);

        socket.on('connect', () => {
          socket.destroy();
          resolve();
        });

        socket.on('error', () => {
          socket.destroy();
          // Retry after 200ms
          setTimeout(() => probe().then(resolve, reject), 200);
        });

        socket.on('timeout', () => {
          socket.destroy();
          // Retry after 200ms
          setTimeout(() => probe().then(resolve, reject), 200);
        });

        socket.connect(port, host);
      });
    };

    return probe();
  }

  /**
   * Wait for any of the given patterns to appear in the stderr stream.
   * Rejects if no pattern matches within timeout.
   */
  static waitForReady(stderr: Readable, patterns: string[], timeout: number): Promise<void> {
    if (!patterns || patterns.length === 0) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Server did not emit any ready pattern within ${timeout}ms`));
      }, timeout);

      const handler = (chunk: Buffer) => {
        const dataStr = chunk.toString('utf8');
        for (const pattern of patterns) {
          if (dataStr.includes(pattern)) {
            clearTimeout(timeoutId);
            stderr.removeListener('data', handler);
            resolve();
            return;
          }
        }
      };

      stderr.on('data', handler);
    });
  }
}
