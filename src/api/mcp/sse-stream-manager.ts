/**
 * SSE Stream Management Utilities for MCP Gateway.
 * Handles cleanup and management of Server-Sent Events streams.
 */

import { logger, LOG_MODULES } from '@utils/logger.js';

/**
 * Helper to clean up stale SSE streams before handling new requests.
 * This preserves sessionId and only cleans up SDK-internal stream state.
 *
 * @param transport - The StreamableHTTPServerTransport instance from MCP SDK
 * @param sessionId - The current session ID for logging purposes
 */
export function cleanupStaleSseStreams(transport: unknown, sessionId: string): void {
  try {
    // Access internal SDK structures to clean up stream mapping
    // The transport wraps a WebStandardStreamableHTTPServerTransport internally
    const webTransport = (transport as {
      _webStandardTransport?: {
        _streamMapping?: Map<string, unknown>;
        _standaloneSseStreamId?: string;
        close?: () => Promise<void>;
      };
    })._webStandardTransport;

    if (webTransport?._streamMapping) {
      const streamId = webTransport._standaloneSseStreamId || '_GET_stream';
      const existingStream = webTransport._streamMapping.get(streamId);

      if (existingStream) {
        logger.debug(`Cleaning up stale SSE stream for session ${sessionId} (preserving session state)`, LOG_MODULES.GATEWAY);

        // Try to call cleanup if available on the stream object
        const streamWithCleanup = existingStream as { cleanup?: () => void };
        if (typeof streamWithCleanup.cleanup === 'function') {
          streamWithCleanup.cleanup();
        } else {
          // Fallback: directly delete from mapping
          webTransport._streamMapping.delete(streamId);
        }

        logger.debug(`Successfully cleaned up SSE stream mapping for session ${sessionId}`, LOG_MODULES.GATEWAY);
      }
    }
  } catch (error) {
    // Non-critical error - if we can't clean up, just continue
    logger.debug(`Error cleaning up SSE streams (non-critical, continuing): ${error}`, LOG_MODULES.GATEWAY);
  }
}
