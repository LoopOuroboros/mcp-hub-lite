/**
 * JSON file-based OAuth token persistence.
 *
 * Stores OAuth credentials (client info, tokens, code verifier) as JSON files
 * in the config directory. Uses atomic writes (tmp + rename) to prevent corruption.
 */

import fs from 'node:fs';
import path from 'node:path';
import { logger, LOG_MODULES } from '@utils/logger/index.js';
import type {
  OAuthClientInformationMixed,
  OAuthTokens,
  OAuthPersistenceData
} from './oauth-types.js';

export class OAuthTokenStorage {
  private cache: OAuthPersistenceData = {};
  private filePath: string;

  constructor(configDir: string, serverUrlHash: string) {
    this.filePath = path.join(configDir, `${serverUrlHash}_oauth.json`);
  }

  private ensureDir(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadFromFile(): OAuthPersistenceData {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(raw) as OAuthPersistenceData;
      }
    } catch (error) {
      logger.warn(
        `Failed to read OAuth storage file: ${error instanceof Error ? error.message : String(error)}`,
        LOG_MODULES.dynamic('oauth-storage')
      );
    }
    return {};
  }

  private saveToFile(data: OAuthPersistenceData): void {
    try {
      this.ensureDir();
      const tmpPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.filePath);
    } catch (error) {
      logger.error(
        `Failed to write OAuth storage file: ${error instanceof Error ? error.message : String(error)}`,
        LOG_MODULES.dynamic('oauth-storage')
      );
    }
  }

  getClientInfo(): OAuthClientInformationMixed | undefined {
    if (!this.cache.clientInfo) {
      this.cache = this.loadFromFile();
    }
    return this.cache.clientInfo;
  }

  saveClientInfo(info: OAuthClientInformationMixed): void {
    this.cache.clientInfo = info;
    this.saveToFile(this.cache);
  }

  getTokens(): OAuthTokens | undefined {
    if (!this.cache.tokens) {
      this.cache = this.loadFromFile();
    }
    return this.cache.tokens;
  }

  saveTokens(tokens: OAuthTokens): void {
    this.cache.tokens = tokens;
    this.saveToFile(this.cache);
  }

  getCodeVerifier(): string | undefined {
    if (!this.cache.codeVerifier) {
      this.cache = this.loadFromFile();
    }
    return this.cache.codeVerifier;
  }

  saveCodeVerifier(verifier: string): void {
    this.cache.codeVerifier = verifier;
    this.saveToFile(this.cache);
  }

  clear(scope: 'all' | 'client' | 'tokens' | 'verifier'): void {
    switch (scope) {
      case 'all':
        this.cache = {};
        break;
      case 'client':
        delete this.cache.clientInfo;
        break;
      case 'tokens':
        delete this.cache.tokens;
        break;
      case 'verifier':
        delete this.cache.codeVerifier;
        break;
    }
    this.saveToFile(this.cache);
  }
}
