import { AsyncLocalStorage } from 'async_hooks';

export interface ClientContext {
  sessionId: string;
  clientName?: string;
  clientVersion?: string;
  protocolVersion?: string;
  cwd?: string;
  project?: string;
  ip?: string;
  userAgent?: string;
  timestamp: number;
}

export const requestContext = new AsyncLocalStorage<ClientContext>();

export function getClientContext(): ClientContext | undefined {
  return requestContext.getStore();
}

export function getClientCwd(): string | undefined {
  return requestContext.getStore()?.cwd;
}
