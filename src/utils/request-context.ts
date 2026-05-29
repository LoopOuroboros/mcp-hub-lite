import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  sessionId?: string;
  traceId?: string;
}

const als = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext(
  context: RequestContext,
  fn: () => Promise<void>
): Promise<void> {
  return als.run(context, fn);
}

export function getSessionIdFromContext(): string | undefined {
  return als.getStore()?.sessionId;
}

export function getTraceIdFromContext(): string | undefined {
  return als.getStore()?.traceId;
}

export function isInRequestContext(): boolean {
  return als.getStore() !== undefined;
}
