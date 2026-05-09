/**
 * Local HTTP server for OAuth callback handling.
 *
 * Listens on 127.0.0.1 with a dynamic port, captures the authorization code
 * from the OAuth redirect, displays a success page to the user, and emits
 * the code via EventEmitter. Auto-closes after 5 minutes of inactivity.
 */

import http from 'node:http';
import { EventEmitter } from 'node:events';
import { logger, LOG_MODULES } from '@utils/logger/index.js';

const CALLBACK_PATH = '/oauth/callback';
const CALLBACK_TIMEOUT = 5 * 60 * 1000; // 5 minutes

const SUCCESS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authentication Successful</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
    h1 { color: #22c55e; margin: 0 0 0.5rem; }
    p { color: #666; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authentication Successful</h1>
    <p>You can close this page and return to MCP Hub Lite.</p>
  </div>
</body>
</html>`;

export class OAuthCallbackServer extends EventEmitter {
  private server: http.Server | null = null;
  private port: number;
  private timeout: NodeJS.Timeout | null = null;

  constructor(port: number = 0) {
    super();
    this.port = port;
  }

  get callbackUrl(): string {
    return `http://127.0.0.1:${this.port}${CALLBACK_PATH}`;
  }

  get redirectUrl(): string {
    return this.callbackUrl;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        if (!req.url) return;

        const url = new URL(req.url, `http://127.0.0.1:${this.port}`);

        if (url.pathname === CALLBACK_PATH) {
          const code = url.searchParams.get('code');

          if (code) {
            logger.info('OAuth callback received authorization code', LOG_MODULES.dynamic('oauth'));
            this.emit('auth-code-received', code);
          }

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(SUCCESS_HTML);
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      this.server.on('error', (err) => {
        logger.error(`OAuth callback server error: ${err.message}`, LOG_MODULES.dynamic('oauth'));
        reject(err);
      });

      this.server.listen(this.port, '127.0.0.1', () => {
        const addr = this.server!.address();
        if (addr && typeof addr === 'object') {
          this.port = addr.port;
        }
        logger.info(
          `OAuth callback server started on ${this.callbackUrl}`,
          LOG_MODULES.dynamic('oauth')
        );

        this.timeout = setTimeout(() => this.stop(), CALLBACK_TIMEOUT);

        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('OAuth callback server stopped', LOG_MODULES.dynamic('oauth'));
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
