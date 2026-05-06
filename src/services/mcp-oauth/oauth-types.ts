/**
 * Type definitions for MCP OAuth authentication.
 */

import type {
  OAuthClientInformationMixed,
  OAuthTokens,
  OAuthClientMetadata
} from '@modelcontextprotocol/sdk/shared/auth.js';

export interface OAuthPersistenceData {
  clientInfo?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  codeVerifier?: string;
}

export interface McpOAuthConfig {
  enabled?: boolean;
  callbackPort?: number;
  configDir?: string;
}

export interface McpOAuthProviderOptions {
  serverUrlHash: string;
  configDir: string;
  callbackPort?: number;
}

export type { OAuthClientInformationMixed, OAuthTokens, OAuthClientMetadata };
