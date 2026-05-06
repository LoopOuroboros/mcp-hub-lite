/**
 * WebSocket state management store
 * Manages WebSocket connections and event handling with the backend
 */

import { defineStore } from 'pinia';
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { ElMessage } from 'element-plus';
import { WebSocketClient, createWebSocketClient } from '@utils/websocket';
import type { ServerMessage } from '@utils/websocket';
import { useServerStore } from '@stores/server';
import type { ServerStatus } from '@stores/server';
import { useToolCallsStore } from '@stores/tool-calls';
import { useSystemStore } from '@stores/system';

// Import WebSocket event type constants from shared types
import { WEB_SOCKET_EVENT_TYPES } from '@shared-types/websocket.types';
// Import specific WebSocket event types from shared types
import type {
  ConfigurationUpdatedEvent,
  ServerStatusEvent,
  LogEvent,
  ToolsEvent,
  ResourcesEvent,
  ServerAddedEvent,
  ServerUpdatedEvent,
  ServerDeletedEvent,
  ServerInstanceAddedEvent,
  ServerInstanceUpdatedEvent,
  ServerInstanceDeletedEvent,
  ServerConnectedEvent,
  ServerDisconnectedEvent
} from '@shared-types/websocket.types';

export const useWebSocketStore = defineStore('websocket', () => {
  const connected = ref(false);
  const wsClient = ref<WebSocketClient | null>(null);
  const serverStore = useServerStore();

  /**
   * Fetch historical logs from the server
   */
  function fetchLogs(
    serverName: string,
    serverIndex: number,
    limit: number = 100,
    since?: number
  ): void {
    if (wsClient.value) {
      wsClient.value.send({
        type: 'fetch-logs',
        serverName,
        serverIndex,
        limit,
        since
      });
    }
  }

  function connect(): void {
    // Build WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/ws`;

    const ws = createWebSocketClient(url);

    ws.connect(
      (message: ServerMessage) => {
        handleServerMessage(message);
      },
      () => {
        // Connection successful
        connected.value = true;
        console.log('WebSocket connected');

        // Subscribe to server status and log events
        ws.send({
          type: 'subscribe',
          eventTypes: [
            WEB_SOCKET_EVENT_TYPES.SERVER_STATUS,
            WEB_SOCKET_EVENT_TYPES.LOG,
            WEB_SOCKET_EVENT_TYPES.TOOLS,
            WEB_SOCKET_EVENT_TYPES.RESOURCES,
            WEB_SOCKET_EVENT_TYPES.SERVER_ADDED,
            WEB_SOCKET_EVENT_TYPES.SERVER_UPDATED,
            WEB_SOCKET_EVENT_TYPES.SERVER_DELETED,
            WEB_SOCKET_EVENT_TYPES.SERVER_INSTANCE_ADDED,
            WEB_SOCKET_EVENT_TYPES.SERVER_INSTANCE_UPDATED,
            WEB_SOCKET_EVENT_TYPES.SERVER_INSTANCE_DELETED,
            WEB_SOCKET_EVENT_TYPES.SERVER_CONNECTED,
            WEB_SOCKET_EVENT_TYPES.SERVER_DISCONNECTED,
            WEB_SOCKET_EVENT_TYPES.TOOL_CALL_STARTED,
            WEB_SOCKET_EVENT_TYPES.TOOL_CALL_COMPLETED,
            WEB_SOCKET_EVENT_TYPES.TOOL_CALL_ERROR,
            WEB_SOCKET_EVENT_TYPES.CONFIGURATION_UPDATED
          ]
        });
      },
      () => {
        // Connection closed
        connected.value = false;
        console.log('WebSocket disconnected');
      },
      (error: Event) => {
        // Connection error
        console.error('WebSocket error:', error);
      }
    );

    wsClient.value = ws;
  }

  function disconnect(): void {
    wsClient.value?.disconnect();
    wsClient.value = null;
    connected.value = false;
  }

  const toolCallsStore = useToolCallsStore();
  const systemStore = useSystemStore();

  function handleServerMessage(message: ServerMessage): void {
    console.log('Received WebSocket message:', message);

    switch (message.type) {
      case WEB_SOCKET_EVENT_TYPES.SERVER_STATUS:
        handleServerStatusChange(message);
        break;
      case WEB_SOCKET_EVENT_TYPES.LOG:
        handleLogEntry(message);
        break;
      case WEB_SOCKET_EVENT_TYPES.TOOLS:
        handleToolsUpdated(message);
        break;
      case WEB_SOCKET_EVENT_TYPES.RESOURCES:
        handleResourcesUpdated(message);
        break;
      case WEB_SOCKET_EVENT_TYPES.SERVER_ADDED:
        handleServerAdded(message);
        break;
      case WEB_SOCKET_EVENT_TYPES.SERVER_UPDATED:
        handleServerUpdated(message);
        break;
      case WEB_SOCKET_EVENT_TYPES.SERVER_DELETED:
        handleServerDeleted(message);
        break;
      case WEB_SOCKET_EVENT_TYPES.SERVER_INSTANCE_ADDED:
        handleServerInstanceAdded(message);
        break;
      case WEB_SOCKET_EVENT_TYPES.SERVER_INSTANCE_UPDATED:
        handleServerInstanceUpdated(message);
        break;
      case WEB_SOCKET_EVENT_TYPES.SERVER_INSTANCE_DELETED:
        handleServerInstanceDeleted(message);
        break;
      case WEB_SOCKET_EVENT_TYPES.SERVER_CONNECTED:
        handleServerConnected(message);
        break;
      case WEB_SOCKET_EVENT_TYPES.SERVER_DISCONNECTED:
        handleServerDisconnected(message);
        break;
      case WEB_SOCKET_EVENT_TYPES.TOOL_CALL_STARTED:
        toolCallsStore.handleToolCallStarted(message.data);
        break;
      case WEB_SOCKET_EVENT_TYPES.TOOL_CALL_COMPLETED:
        toolCallsStore.handleToolCallCompleted(message.data);
        break;
      case WEB_SOCKET_EVENT_TYPES.TOOL_CALL_ERROR:
        toolCallsStore.handleToolCallError(message.data);
        break;
      case WEB_SOCKET_EVENT_TYPES.CONFIGURATION_UPDATED:
        handleConfigurationUpdated(message);
        break;
      case WEB_SOCKET_EVENT_TYPES.PONG:
        // Heartbeat response, ignore
        break;
      default:
        console.warn('Unknown WebSocket message type:', (message as { type: string }).type);
    }
  }

  function handleConfigurationUpdated(message: ConfigurationUpdatedEvent): void {
    console.log('Configuration updated:', message.data);
    systemStore.fetchConfig();
  }

  function handleServerStatusChange(message: ServerStatusEvent): void {
    const { serverName, status, error } = message.data;
    serverStore.updateServerStatus(serverName, mapStatus(status));

    if (error) {
      console.error(`Server ${serverName} error:`, error);
    }
  }

  function handleLogEntry(message: LogEvent): void {
    const { serverName, logs } = message.data;
    const server = serverStore.servers.find((s) => s.id === serverName);
    if (server && logs && logs.length > 0) {
      // If it's a complete log (more than 1 entry), replace existing logs
      if (logs.length > 1) {
        server.logs = logs;
      } else {
        // Incremental log, append to existing logs
        const logEntry = logs[0];
        if (logEntry && logEntry.timestamp) {
          server.logs.push({
            timestamp: logEntry.timestamp,
            level: logEntry.level,
            message: logEntry.message
          });
        }
      }

      // Limit log entries to prevent memory leaks
      const maxLogs = 1000;
      if (server.logs.length > maxLogs) {
        server.logs.splice(0, server.logs.length - maxLogs);
      }
    }
  }

  function handleToolsUpdated(message: ToolsEvent): void {
    const { serverName, tools } = message.data;
    const server = serverStore.servers.find((s) => s.id === serverName);
    if (server) {
      server.tools = tools;
      server.toolsCount = tools.length;
    }
  }

  function handleResourcesUpdated(message: ResourcesEvent): void {
    const { serverName, resources } = message.data;
    const server = serverStore.servers.find((s) => s.id === serverName);
    if (server) {
      server.resources = resources;
      server.resourcesCount = resources.length;
    }
  }

  function handleServerAdded(message: ServerAddedEvent): void {
    console.log('Server added:', message.data);
    serverStore.fetchServers();
  }

  // Server update event emitter

  function handleServerUpdated(message: ServerUpdatedEvent): void {
    console.log('Server updated:', message.data);
    serverStore.fetchServers();
  }

  function handleServerDeleted(message: ServerDeletedEvent): void {
    console.log('Server deleted:', message.data);
    serverStore.fetchServers();
  }

  function handleServerInstanceAdded(message: ServerInstanceAddedEvent): void {
    const { name, instance } = message.data;
    serverStore.addInstanceLocal(name, instance);
    ElMessage.info(`Server instance #${instance.index} added for ${name}`);
  }

  function handleServerInstanceUpdated(message: ServerInstanceUpdatedEvent): void {
    const { name, index, updates } = message.data;
    serverStore.updateInstanceLocal(name, index, updates);
    if (updates.displayName) {
      ElMessage.info(`Instance #${index} renamed to "${updates.displayName}"`);
    }
  }

  function handleServerInstanceDeleted(message: ServerInstanceDeletedEvent): void {
    const { name, index } = message.data;
    serverStore.removeInstanceLocal(name, index);
    ElMessage.info(`Server instance #${index} removed from ${name}`);
  }

  function handleServerConnected(message: ServerConnectedEvent): void {
    const { serverName } = message.data;
    serverStore.updateServerStatus(serverName, 'online');
  }

  function handleServerDisconnected(message: ServerDisconnectedEvent): void {
    const { serverName } = message.data;
    serverStore.updateServerStatus(serverName, 'offline');
  }

  function mapStatus(status: string): ServerStatus {
    const validStatuses: ServerStatus[] = ['online', 'offline', 'error', 'starting', 'stopping'];
    return validStatuses.includes(status as ServerStatus) ? (status as ServerStatus) : 'starting';
  }

  // Connect when component is mounted
  onMounted(() => {
    connect();
  });

  // Disconnect before component is unmounted
  onBeforeUnmount(() => {
    disconnect();
  });

  return {
    connected,
    connect,
    disconnect,
    fetchLogs
  };
});
