/**
 * MCP OAuth Client Provider implementing the SDK's OAuthClientProvider interface.
 *
 * Handles the full OAuth 2.0 authorization code flow with PKCE for MCP servers:
 * - Persists tokens and client info to JSON files
 * - Opens system browser for user authorization
 * - Manages a local HTTP callback server for auth code capture
 * - Supports token refresh and credential invalidation
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type {
  OAuthClientInformationMixed,
  OAuthTokens,
  OAuthClientMetadata
} from '@modelcontextprotocol/sdk/shared/auth.js';
import { OAuthTokenStorage } from './oauth-token-storage.js';
import { OAuthCallbackServer } from './oauth-callback-server.js';
import type { McpOAuthProviderOptions } from './oauth-types.js';

const execAsync = promisify(exec);

const DEFAULT_CONFIG_DIR = path.join(os.homedir(), '.mcp-hub-lite', 'oauth');

export class McpOAuthClientProvider implements OAuthClientProvider {
  private _callbackServer: OAuthCallbackServer | null = null;
  private storage: OAuthTokenStorage;
  private _configDir: string;
  private _callbackPort: number;
  private _serverUrlHash: string;

  constructor(options: McpOAuthProviderOptions) {
    this._serverUrlHash = options.serverUrlHash;
    this._configDir = options.configDir || DEFAULT_CONFIG_DIR;
    this._callbackPort = options.callbackPort || 0;
    this.storage = new OAuthTokenStorage(this._configDir, this._serverUrlHash);
  }

  get redirectUrl(): string {
    if (!this._callbackServer) return '';
    return this._callbackServer.redirectUrl;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [this.redirectUrl],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      client_name: 'MCP Hub Lite'
    } as OAuthClientMetadata;
  }

  clientInformation(): OAuthClientInformationMixed | undefined {
    return this.storage.getClientInfo();
  }

  saveClientInformation(info: OAuthClientInformationMixed): void {
    this.storage.saveClientInfo(info);
  }

  tokens(): OAuthTokens | undefined {
    return this.storage.getTokens();
  }

  saveTokens(tokens: OAuthTokens): void {
    this.storage.saveTokens(tokens);
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    const urlStr = authorizationUrl.toString();
    const platform = process.platform;
    let command: string;

    if (platform === 'win32') {
      command = `start "" "${urlStr}"`;
    } else if (platform === 'darwin') {
      command = `open "${urlStr}"`;
    } else {
      command = `xdg-open "${urlStr}"`;
    }

    try {
      await execAsync(command);
    } catch {
      // Fallback: spawn detached
      const { spawn } = await import('node:child_process');
      if (platform === 'win32') {
        spawn('cmd', ['/c', 'start', '', urlStr], { detached: true, stdio: 'ignore' }).unref();
      } else if (platform === 'darwin') {
        spawn('open', [urlStr], { detached: true, stdio: 'ignore' }).unref();
      } else {
        spawn('xdg-open', [urlStr], { detached: true, stdio: 'ignore' }).unref();
      }
    }
  }

  saveCodeVerifier(codeVerifier: string): void {
    this.storage.saveCodeVerifier(codeVerifier);
  }

  codeVerifier(): string {
    return this.storage.getCodeVerifier() || '';
  }

  async invalidateCredentials(
    scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery'
  ): Promise<void> {
    if (scope === 'discovery') return; // Not persisted
    this.storage.clear(scope);
  }

  /**
   * Starts the local callback server for auth code capture.
   * Idempotent — returns existing server if already running.
   */
  async startCallbackServer(): Promise<OAuthCallbackServer> {
    if (this._callbackServer) {
      return this._callbackServer;
    }
    this._callbackServer = new OAuthCallbackServer(this._callbackPort);
    await this._callbackServer.start();
    return this._callbackServer;
  }

  /**
   * Stops the callback server after auth flow completes.
   */
  async stopCallbackServer(): Promise<void> {
    if (this._callbackServer) {
      await this._callbackServer.stop();
      this._callbackServer = null;
    }
  }

  getCallbackServer(): OAuthCallbackServer | null {
    return this._callbackServer;
  }
}
