import { AsyncLocalStorage } from 'async_hooks';
import type { ClientContext } from '@shared-types/client.types';

export const requestContext = new AsyncLocalStorage<ClientContext>();

export function getClientContext(): ClientContext | undefined {
  return requestContext.getStore();
}

export function getClientCwd(): string | undefined {
  return requestContext.getStore()?.cwd;
}
