/**
 * Event Bus Service
 * Used for publishing and subscribing to events throughout the application
 * Supports propagation of server status changes, log updates, tool updates, and other events
 */

import type { EventData } from '@models/event.model.js';

export interface EventBusEvent {
  type: string;
  data: EventData;
}

export class EventBusService {
  private listeners = new Map<string, Set<(data: EventData) => void>>();

  /**
   * Publish event
   * @param eventType Event type
   * @param data Event data
   */
  publish(eventType: string, data: EventData): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for type ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * Subscribe to event
   * @param eventType Event type
   * @param listener Event listener
   * @returns Unsubscribe function
   */
  subscribe(eventType: string, listener: (data: EventData) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    // Return unsubscribe function
    return () => this.unsubscribe(eventType, listener);
  }

  /**
   * Unsubscribe from event
   * @param eventType Event type
   * @param listener Event listener
   */
  private unsubscribe(eventType: string, listener: (data: EventData) => void): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
      // If the listeners for this event type are empty, remove the event type entry
      if (listeners.size === 0) {
        this.listeners.delete(eventType);
      }
    }
  }

  /**
   * Unsubscribe from all events
   */
  unsubscribeAll(): void {
    this.listeners.clear();
  }

  /**
   * Get all registered event types
   */
  getEventTypes(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Get the number of listeners for a specific event type
   * @param eventType Event type
   */
  getListenerCount(eventType: string): number {
    const listeners = this.listeners.get(eventType);
    return listeners ? listeners.size : 0;
  }
}

// Event type constants
export const EventTypes = {
  // Server status related events
  SERVER_STATUS_CHANGE: 'server-status',
  SERVER_CONNECTED: 'server-connected',
  SERVER_DISCONNECTED: 'server-disconnected',

  // Server management events
  SERVER_ADDED: 'server-added',
  SERVER_UPDATED: 'server-updated',
  SERVER_DELETED: 'server-deleted',
  SERVER_INSTANCE_ADDED: 'server-instance-added',
  SERVER_INSTANCE_UPDATED: 'server-instance-updated',
  SERVER_INSTANCE_DELETED: 'server-instance-deleted',

  // Tool related events
  TOOLS_UPDATED: 'tools',
  TOOL_CALL_STARTED: 'tool-call-started',
  TOOL_CALL_COMPLETED: 'tool-call-completed',
  TOOL_CALL_ERROR: 'tool-call-error',

  // Resource related events
  RESOURCES_UPDATED: 'resources',

  // Log related events
  LOG_ENTRY: 'log',
  LOGS_CLEARED: 'logs-cleared',

  // System related events
  SYSTEM_HEALTH: 'system-health',
  CONFIGURATION_UPDATED: 'configuration-updated',

  // Client related events
  CLIENT_CONNECTED: 'client-connected',
  CLIENT_DISCONNECTED: 'client-disconnected'
} as const;

// Create global event bus instance
export const eventBus = new EventBusService();
