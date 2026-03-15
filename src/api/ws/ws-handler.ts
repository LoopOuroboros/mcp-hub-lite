/**
 * WebSocket Connection Handler
 *
 * Manages the complete lifecycle and message handling for individual WebSocket connections
 * between MCP Hub Lite clients and the server. This class handles client subscriptions,
 * message routing, heartbeat management, and event distribution through the system's
 * event bus architecture.
 *
 * The handler supports multiple message types including:
 * - Subscription management (subscribe/unsubscribe to event types)
 * - Heartbeat/ping-pong for connection health monitoring
 * - Historical log retrieval requests
 * - Real-time event delivery from the event bus
 *
 * It maintains a mapping between WebSocket event types and internal system event types,
 * ensuring proper protocol translation and secure message delivery. The handler also
 * implements robust error handling and connection cleanup to prevent resource leaks.
 *
 * @example
 * ```typescript
 * // Create a new WebSocket handler instance
 * const handler = new WebSocketHandler(socket, eventBus);
 * handler.initialize();
 * ```
 */

import { WebSocket } from 'ws';
import { EventBusService, EventTypes } from '@services/event-bus.service.js';
import { logStorage } from '@services/log-storage.service.js';
import { logger, LOG_MODULES } from '@utils/logger.js';
import { WEB_SOCKET_EVENT_TYPES } from '@shared-types/websocket.types.js';
import type {
  ClientMessage,
  ServerMessage,
  SubscribeMessage,
  UnsubscribeMessage,
  FetchLogsMessage,
  WebSocketEventType
} from '@shared-types/websocket.types.js';

// Event type mapping
const eventTypeMap: Record<string, string> = {
  [EventTypes.SERVER_STATUS_CHANGE]: WEB_SOCKET_EVENT_TYPES.SERVER_STATUS,
  [EventTypes.SERVER_CONNECTED]: WEB_SOCKET_EVENT_TYPES.SERVER_CONNECTED,
  [EventTypes.SERVER_DISCONNECTED]: WEB_SOCKET_EVENT_TYPES.SERVER_DISCONNECTED,
  [EventTypes.SERVER_ADDED]: WEB_SOCKET_EVENT_TYPES.SERVER_ADDED,
  [EventTypes.SERVER_UPDATED]: WEB_SOCKET_EVENT_TYPES.SERVER_UPDATED,
  [EventTypes.SERVER_DELETED]: WEB_SOCKET_EVENT_TYPES.SERVER_DELETED,
  [EventTypes.TOOLS_UPDATED]: WEB_SOCKET_EVENT_TYPES.TOOLS,
  [EventTypes.RESOURCES_UPDATED]: WEB_SOCKET_EVENT_TYPES.RESOURCES,
  [EventTypes.LOG_ENTRY]: WEB_SOCKET_EVENT_TYPES.LOG,
  [EventTypes.TOOL_CALL_STARTED]: WEB_SOCKET_EVENT_TYPES.TOOL_CALL_STARTED,
  [EventTypes.TOOL_CALL_COMPLETED]: WEB_SOCKET_EVENT_TYPES.TOOL_CALL_COMPLETED,
  [EventTypes.TOOL_CALL_ERROR]: WEB_SOCKET_EVENT_TYPES.TOOL_CALL_ERROR,
  [EventTypes.CONFIGURATION_UPDATED]: WEB_SOCKET_EVENT_TYPES.CONFIGURATION_UPDATED,
  [EventTypes.CLIENT_CONNECTED]: WEB_SOCKET_EVENT_TYPES.CLIENT_CONNECTED,
  [EventTypes.CLIENT_DISCONNECTED]: WEB_SOCKET_EVENT_TYPES.CLIENT_DISCONNECTED
};

export class WebSocketHandler {
  private subscriptions = new Map<keyof typeof EventTypes, () => void>(); // Store subscriptions and their corresponding unsubscribe functions
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(
    private socket: WebSocket,
    private eventBus: EventBusService // Event bus instance
  ) {}

  /**
   * Initialize WebSocket connection
   */
  initialize(): void {
    this.socket.on('message', this.handleMessage.bind(this));
    this.socket.on('close', this.handleClose.bind(this));
    this.socket.on('error', this.handleError.bind(this));

    // Start heartbeat detection
    this.startHeartbeat();

    logger.debug('connection established', LOG_MODULES.WEBSOCKET);
  }

  /**
   * Handle client messages
   */
  private handleMessage(data: Buffer | string): void {
    try {
      const message: ClientMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(message);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(message);
          break;
        case 'ping':
          this.handlePing();
          break;
        case 'fetch-logs':
          this.handleFetchLogs(message);
          break;
        default:
          logger.warn(
            `Unknown message type: ${(message as ClientMessage).type}`,
            LOG_MODULES.WEBSOCKET
          );
      }
    } catch (error) {
      logger.error(`Failed to parse WebSocket message: ${error}`, LOG_MODULES.WEBSOCKET);
      this.sendError('Invalid message format');
    }
  }

  /**
   * Handle fetch historical logs request
   */
  private handleFetchLogs(message: FetchLogsMessage): void {
    const logs = logStorage.getLogs(message.serverId, {
      limit: message.limit || 100,
      since: message.since
    });

    this.send({
      type: 'log',
      data: {
        serverId: message.serverId,
        logs: logs
      }
    } as ServerMessage);
  }

  /**
   * Handle subscription events
   */
  private handleSubscribe(message: SubscribeMessage): void {
    message.eventTypes.forEach((eventType) => {
      // Map WebSocket event types to internal event types
      const internalEventType = Object.entries(eventTypeMap).find(
        ([, wsType]) => wsType === eventType
      )?.[0] as keyof typeof EventTypes;

      if (internalEventType && !this.subscriptions.has(internalEventType)) {
        // Subscribe to event bus
        const unsubscribe = this.eventBus.subscribe(internalEventType, (data) => {
          const mappedType = eventTypeMap[internalEventType] as WebSocketEventType;
          if (mappedType) {
            this.send({
              type: mappedType,
              data
            } as ServerMessage);
          }
        });

        this.subscriptions.set(internalEventType, unsubscribe);
      }
    });

    logger.info(
      `Subscribed to events: ${Array.from(this.subscriptions.keys()).sort().join(', ')}`,
      LOG_MODULES.WEBSOCKET
    );
  }

  /**
   * Handle unsubscribe events
   */
  private handleUnsubscribe(message: UnsubscribeMessage): void {
    message.eventTypes.forEach((eventType) => {
      // Map WebSocket event types to internal event types
      const internalEventType = Object.entries(eventTypeMap).find(
        ([, wsType]) => wsType === eventType
      )?.[0] as keyof typeof EventTypes;

      if (internalEventType) {
        const unsubscribe = this.subscriptions.get(internalEventType);
        if (unsubscribe) {
          unsubscribe(); // Call unsubscribe function
          this.subscriptions.delete(internalEventType);
        }
      }
    });

    logger.info(
      `Remaining subscriptions: ${Array.from(this.subscriptions.keys()).sort().join(', ')}`,
      LOG_MODULES.WEBSOCKET
    );
  }

  /**
   * Handle connection close
   */
  private handleClose(): void {
    logger.info('connection closed', LOG_MODULES.WEBSOCKET);
    this.stopHeartbeat();

    // Unsubscribe from all events
    this.subscriptions.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.subscriptions.clear();
  }

  /**
   * Handle heartbeat request
   */
  private handlePing(): void {
    this.send({
      type: 'pong',
      timestamp: Date.now()
    } as ServerMessage);
  }

  /**
   * Handle connection error
   */
  private handleError(error: Error): void {
    logger.error(`error: ${error}`, LOG_MODULES.WEBSOCKET);
  }

  /**
   * Send message to client
   */
  private send(message: ServerMessage): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message
   */
  private sendError(message: string): void {
    this.send({
      type: 'error',
      data: { message }
    } as ServerMessage);
  }

  /**
   * Start heartbeat detection
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.send({
        type: 'pong',
        timestamp: Date.now()
      } as ServerMessage);
    }, 30000); // Send heartbeat every 30 seconds
  }

  /**
   * Stop heartbeat detection
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }
}
