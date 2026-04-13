/**
 * Tool call status management store
 * Manages tool call progress, results, and errors
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  ToolCallStartedEvent,
  ToolCallCompletedEvent,
  ToolCallErrorEvent
} from '@shared-types/websocket.types';

export interface ToolCall {
  requestId: string;
  serverName: string;
  serverIndex: number;
  toolName: string;
  startTime: number;
  endTime?: number;
  status: 'running' | 'completed' | 'error';
  args?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  progress?: number; // 0-100
}

export const useToolCallsStore = defineStore('toolCalls', () => {
  const calls = ref<Map<string, ToolCall>>(new Map());

  const runningCalls = computed(() =>
    Array.from(calls.value.values()).filter((c) => c.status === 'running')
  );

  // Add or update call
  function updateCall(call: ToolCall) {
    calls.value.set(call.requestId, call);
  }

  // Get call
  function getCall(requestId: string): ToolCall | undefined {
    return calls.value.get(requestId);
  }

  // Complete call
  function completeCall(requestId: string, result: unknown, error?: string) {
    const call = calls.value.get(requestId);
    if (call) {
      call.status = error ? 'error' : 'completed';
      call.endTime = Date.now();
      call.result = error ? undefined : result;
      call.error = error;
    }
  }

  // Handle tool call started event
  function handleToolCallStarted(data: ToolCallStartedEvent['data']) {
    updateCall({
      requestId: data.requestId,
      serverName: data.serverName,
      serverIndex: data.serverIndex,
      toolName: data.toolName,
      startTime: data.timestamp,
      status: 'running',
      args: data.args,
      progress: 0
    });
  }

  // Handle tool call completed event
  function handleToolCallCompleted(data: ToolCallCompletedEvent['data']) {
    completeCall(data.requestId, data.result);
  }

  // Handle tool call error event
  function handleToolCallError(data: ToolCallErrorEvent['data']) {
    completeCall(data.requestId, undefined, data.error);
  }

  return {
    calls,
    runningCalls,
    updateCall,
    getCall,
    completeCall,
    handleToolCallStarted,
    handleToolCallCompleted,
    handleToolCallError
  };
});
