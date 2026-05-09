/**
 * Event Bus Service
 *
 * Centralized event management system for decoupled communication between different modules
 * throughout the MCP Hub Lite application. This service implements the publish-subscribe
 * pattern to enable loose coupling between components while maintaining efficient
 * event-driven architecture.
 *
 * The event bus handles various types of events including server status changes,
 * connection state updates, tool registry changes, log entries, configuration updates,
 * and system health notifications. It provides thread-safe operations with error
 * handling for listener callbacks to prevent cascading failures.
 *
 * Usage scenarios:
 * - Server management modules publish server lifecycle events
 * - Connection managers notify about connection state changes
 * - UI components subscribe to relevant events for real-time updates
 * - Logging services broadcast log entries to interested parties
 * - Configuration services announce configuration changes
 *
 * All public methods are safe to call from any part of the application, and the service
 * automatically manages memory by cleaning up empty event type entries when all listeners
 * are unsubscribed.
 */

import type { EventData } from '@models/event.model.js';

/**
 * Interface representing a published event with its type and associated data.
 *
 * @interface EventBusEvent
 * @property {string} type - The event type identifier (e.g., 'server-connected', 'tools-updated')
 * @property {EventData} data - The event payload containing relevant data for the event
 */
export interface EventBusEvent {
  type: string;
  data: EventData;
}

export class EventBusService {
  private listeners = new Map<string, Set<(data: EventData) => void>>();

  /**
   * Publishes an event to all subscribed listeners for the specified event type.
   *
   * This method notifies all registered listeners for the given event type by
   * invoking their callback functions with the provided event data. Each listener
   * is executed in a try-catch block to prevent errors in one listener from
   * affecting other listeners or the publisher.
   *
   * @param {string} eventType - The type of event to publish (e.g., EventTypes.SERVER_CONNECTED)
   * @param {EventData} data - The event payload data to be passed to all listeners
   * @throws {Error} - Never throws; errors in listeners are caught and logged to console.error
   *
   * @example
   * ```typescript
   * eventBus.publish(EventTypes.SERVER_CONNECTED, { serverId: 'server-1', timestamp: Date.now() });
   * ```
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
   * Subscribes a listener function to receive events of the specified type.
   *
   * Registers the provided listener callback to be invoked whenever an event
   * of the specified type is published. Returns an unsubscribe function that
   * can be called to remove the listener registration.
   *
   * The service automatically creates a new listener set for the event type
   * if it doesn't already exist, ensuring safe concurrent access.
   *
   * @param {string} eventType - The event type to subscribe to (e.g., EventTypes.TOOLS_UPDATED)
   * @param {(data: EventData) => void} listener - The callback function to invoke when the event is published
   * @returns {() => void} A function that, when called, unsubscribes the listener from the event type
   *
   * @example
   * ```typescript
   * const unsubscribe = eventBus.subscribe(EventTypes.SERVER_DISCONNECTED, (data) => {
   *   console.log('Server disconnected:', data.serverId);
   * });
   * // Later, to unsubscribe:
   * unsubscribe();
   * ```
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
   * Unsubscribes a listener from receiving events of the specified type.
   *
   * Removes the specified listener from the registry for the given event type.
   * If this was the last listener for the event type, the entire event type
   * entry is removed from the registry to free memory.
   *
   * This method is private and should only be called internally by the
   * unsubscribe function returned by the subscribe method.
   *
   * @param {string} eventType - The event type to unsubscribe from
   * @param {(data: EventData) => void} listener - The listener function to remove
   * @access private
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
   * Unsubscribes all listeners from all event types.
   *
   * Clears the entire listener registry, effectively removing all subscriptions
   * across all event types. This is typically used during application shutdown
   * or when a complete reset of the event system is required.
   *
   * @returns {void}
   *
   * @example
   * ```typescript
   * // Clean up all event subscriptions before application shutdown
   * eventBus.unsubscribeAll();
   * ```
   */
  unsubscribeAll(): void {
    this.listeners.clear();
  }

  /**
   * Retrieves all currently registered event types that have active listeners.
   *
   * Returns an array of event type strings that currently have at least one
   * subscribed listener. This can be useful for debugging, monitoring, or
   * introspection purposes.
   *
   * @returns {string[]} Array of event type strings with active listeners
   *
   * @example
   * ```typescript
   * const activeEventTypes = eventBus.getEventTypes();
   * console.log('Active event types:', activeEventTypes);
   * ```
   */
  getEventTypes(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Gets the number of active listeners subscribed to a specific event type.
   *
   * Returns the count of listener functions currently registered for the
   * specified event type. Returns 0 if no listeners are registered for
   * the event type or if the event type doesn't exist.
   *
   * @param {string} eventType - The event type to check listener count for
   * @returns {number} The number of active listeners for the event type (0 if none)
   *
   * @example
   * ```typescript
   * const listenerCount = eventBus.getListenerCount(EventTypes.LOG_ENTRY);
   * console.log(`There are ${listenerCount} listeners for log entries`);
   * ```
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

  // System related events
  CONFIGURATION_UPDATED: 'configuration-updated'
} as const;

// Create global event bus instance
export const eventBus = new EventBusService();
