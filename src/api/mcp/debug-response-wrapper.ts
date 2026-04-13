/**
 * Debug Response Wrapper for MCP Gateway.
 * Wraps Fastify reply to capture and log response content in development mode.
 */

import type { FastifyReply } from 'fastify';
import {
  logger,
  LOG_MODULES,
  isToolsListResponse,
  simplifyToolsListResponse,
  hasImageContent,
  simplifyImageContent
} from '@utils/logger.js';
import { stringifyForLogging, getMcpCommDebugSetting } from '@utils/json-utils.js';

/**
 * Wraps Fastify reply to capture and log response content in development mode.
 *
 * @param reply - Fastify reply object to wrap
 * @param sessionId - Current session ID for logging
 */
export function wrapReplyForDebug(reply: FastifyReply, sessionId: string): void {
  // Only wrap for debug logging if MCP_COMM_DEBUG is enabled
  if (!getMcpCommDebugSetting()) {
    return;
  }

  const originalWrite = reply.raw.write.bind(reply.raw);
  const originalEnd = reply.raw.end.bind(reply.raw);
  let responseBuffer = '';
  let socketBuffer = '';
  let hasLoggedResponse = false;
  let socketWrapped = false;

  logger.debug(
    `Wrapping response - writable: ${reply.raw.writable}, destroyed: ${reply.raw.destroyed}, socket: ${!!reply.raw.socket}`,
    LOG_MODULES.COMMUNICATION
  );

  // Wrap socket write if socket exists (for transports that bypass http.ServerResponse.write/end)
  const wrapSocket = () => {
    if (socketWrapped || !reply.raw.socket) {
      return;
    }

    const socket = reply.raw.socket;
    const originalSocketWrite = socket.write.bind(socket);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.write = function (data: any, encoding?: any, callback?: any) {
      try {
        if (typeof data === 'string') {
          socketBuffer += data;
        } else if (data instanceof Buffer) {
          socketBuffer += data.toString(encoding || 'utf8');
        } else if (data instanceof Uint8Array) {
          try {
            socketBuffer += new TextDecoder('utf-8').decode(data);
          } catch {
            socketBuffer += `[Binary data: ${data.length} bytes]`;
          }
        }
      } catch (error) {
        logger.debug(
          `MCP Gateway: Error processing socket write: ${error}`,
          LOG_MODULES.COMMUNICATION
        );
      }
      return originalSocketWrite(data, encoding, callback);
    };

    // Also listen for socket finish to log any remaining data
    socket.once('finish', () => {
      if (!hasLoggedResponse && (socketBuffer.length > 0 || responseBuffer.length > 0)) {
        logFinalResponse();
      }
    });

    socketWrapped = true;
    logger.debug(
      `MCP Gateway: Socket wrapped successfully for session ${sessionId}`,
      LOG_MODULES.COMMUNICATION
    );
  };

  // Helper function to format and log response
  const logFinalResponse = () => {
    if (hasLoggedResponse) {
      return;
    }
    hasLoggedResponse = true;

    // Determine which buffer to use
    const primaryBuffer = responseBuffer.length > 0 ? responseBuffer : socketBuffer;
    const bufferSource = responseBuffer.length > 0 ? 'http.ServerResponse' : 'socket';

    if (primaryBuffer.length === 0) {
      logger.debug(
        `MCP Gateway response for ${sessionId}: [No response data captured - transport may have used direct socket operations]`,
        LOG_MODULES.COMMUNICATION
      );
      return;
    }

    // Log response content, simplify tools/list responses and image content
    let logResponse = primaryBuffer;
    try {
      if (isToolsListResponse(logResponse)) {
        const simplified = simplifyToolsListResponse(logResponse);
        if (simplified !== null) {
          logResponse = simplified;
        } else {
          // Could not simplify, format as pretty JSON
          try {
            // Handle SSE format
            if (logResponse.includes('event: message') && logResponse.includes('data:')) {
              const dataMatch = logResponse.match(/data: ([^\n]+)/);
              if (dataMatch) {
                const jsonData = dataMatch[1].trim();
                const parsed = JSON.parse(jsonData);
                const formattedData = stringifyForLogging(parsed);
                logResponse = `event: message\ndata: ${formattedData}`;
              }
            } else {
              const parsed = JSON.parse(logResponse);
              logResponse = stringifyForLogging(parsed);
            }
          } catch {
            // If parsing fails, use original
          }
        }
      } else if (hasImageContent(logResponse)) {
        // Simplify image content first
        const simplified = simplifyImageContent(logResponse);
        // Then format for logging
        if (simplified.includes('event: message') && simplified.includes('data:')) {
          const dataMatch = simplified.match(/data: ([^\n]+)/);
          if (dataMatch) {
            const jsonData = dataMatch[1].trim();
            try {
              const parsed = JSON.parse(jsonData);
              const formattedData = stringifyForLogging(parsed);
              logResponse = `event: message\ndata: ${formattedData}`;
            } catch {
              logResponse = simplified;
            }
          } else {
            logResponse = simplified;
          }
        } else {
          const parsed = JSON.parse(simplified);
          logResponse = stringifyForLogging(parsed);
        }
      } else {
        // Handle SSE format responses (event: message followed by data: JSON)
        if (primaryBuffer.includes('event: message') && primaryBuffer.includes('data:')) {
          const dataMatch = primaryBuffer.match(/data: ([^\n]+)/);
          if (dataMatch) {
            const jsonData = dataMatch[1].trim();
            try {
              const parsed = JSON.parse(jsonData);
              const formattedData = stringifyForLogging(parsed);
              logResponse = `event: message\ndata: ${formattedData}`;
            } catch {
              logResponse = primaryBuffer;
            }
          } else {
            logResponse = primaryBuffer;
          }
        } else {
          // Try to format other JSON responses to improve readability
          const parsed = JSON.parse(primaryBuffer);
          logResponse = stringifyForLogging(parsed);
        }
      }
    } catch {
      // If not valid JSON, output as-is and truncate long content
      logResponse =
        primaryBuffer.length > 500 ? primaryBuffer.substring(0, 500) + '...' : primaryBuffer;
    }
    logger.debug(
      `MCP Gateway response for ${sessionId} (source: ${bufferSource}):\n${logResponse.trimEnd()}`,
      LOG_MODULES.COMMUNICATION
    );
  };

  // Try to wrap socket immediately
  wrapSocket();

  // Also try to wrap socket when it becomes available (in case it's not yet attached)
  reply.raw.once('socket', () => {
    wrapSocket();
  });

  // Wrap write method
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reply.raw.write = function (chunk: any, encoding?: any, callback?: any) {
    try {
      let chunkStr = '';
      if (typeof chunk === 'string') {
        chunkStr = chunk;
      } else if (chunk instanceof Buffer) {
        chunkStr = chunk.toString(encoding || 'utf8');
      } else if (chunk instanceof Uint8Array) {
        // Try to convert Uint8Array to string (for SSE event streams)
        try {
          chunkStr = new TextDecoder('utf-8').decode(chunk);
        } catch {
          // If unable to decode as text, provide binary summary
          chunkStr = `[Binary data: ${chunk.length} bytes]`;
        }
      } else if (typeof chunk === 'object') {
        chunkStr = JSON.stringify(chunk);
      } else {
        chunkStr = String(chunk);
      }
      responseBuffer += chunkStr;
    } catch (error) {
      logger.debug(
        `MCP Gateway: Error processing write chunk: ${error}`,
        LOG_MODULES.COMMUNICATION
      );
    }
    return originalWrite(chunk, encoding, callback);
  };

  // Wrap end method
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reply.raw.end = function (chunk?: any, encoding?: any, callback?: any) {
    try {
      if (chunk !== undefined && chunk !== null) {
        let chunkStr = '';
        if (typeof chunk === 'string') {
          chunkStr = chunk;
        } else if (chunk instanceof Buffer) {
          chunkStr = chunk.toString(encoding || 'utf8');
        } else if (chunk instanceof Uint8Array) {
          // Try to convert Uint8Array to string (for SSE event streams)
          try {
            chunkStr = new TextDecoder('utf-8').decode(chunk);
          } catch {
            // If unable to decode as text, provide binary summary
            chunkStr = `[Binary data: ${chunk.length} bytes]`;
          }
        } else if (typeof chunk === 'object') {
          chunkStr = JSON.stringify(chunk);
        } else {
          chunkStr = String(chunk);
        }
        responseBuffer += chunkStr;
      }

      // Log response before calling original end
      logFinalResponse();
    } catch (error) {
      logger.debug(`MCP Gateway: Error processing end chunk: ${error}`, LOG_MODULES.COMMUNICATION);
    }
    return originalEnd(chunk, encoding, callback);
  };

  // Also wrap writeHead method to capture error response headers
  const originalWriteHead = reply.raw.writeHead.bind(reply.raw);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reply.raw.writeHead = function (statusCode: number, ...args: any[]) {
    try {
      // Ensure socket is wrapped before any response is sent
      wrapSocket();

      // If it's an error response, log status code and headers
      if (statusCode >= 400) {
        let statusMessage: string | undefined;
        let headers: Record<string, unknown> | undefined;

        // Handle multiple parameter forms of Node.js writeHead
        if (args.length === 1) {
          // writeHead(statusCode, headers)
          headers = args[0] as Record<string, unknown>;
        } else if (args.length === 2) {
          // writeHead(statusCode, statusMessage, headers) or writeHead(statusCode, headers)
          if (typeof args[0] === 'string') {
            statusMessage = args[0];
            headers = args[1] as Record<string, unknown>;
          } else {
            headers = args[0] as Record<string, unknown>;
          }
        }

        if (headers) {
          logger.debug(
            `Full error response context - statusCode: ${statusCode}, statusMessage: ${statusMessage || 'none'}, headers: ${stringifyForLogging(headers)}`,
            LOG_MODULES.COMMUNICATION
          );
        } else {
          logger.debug(
            `Full error response context - statusCode: ${statusCode}, statusMessage: ${statusMessage || 'none'}`,
            LOG_MODULES.COMMUNICATION
          );
        }
      }
    } catch (error) {
      logger.debug(`MCP Gateway: Error processing writeHead: ${error}`, LOG_MODULES.COMMUNICATION);
    }
    return originalWriteHead(statusCode, ...args);
  };

  // Set up fallback logging in case end() is never called
  reply.raw.once('finish', () => {
    if (!hasLoggedResponse) {
      logFinalResponse();
    }
  });

  // Also set up close event for fallback
  reply.raw.once('close', () => {
    if (!hasLoggedResponse) {
      logFinalResponse();
    }
  });
}
