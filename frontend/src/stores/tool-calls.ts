/**
 * 工具调用状态管理 Store
 * 管理工具调用的进度、结果和错误
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ToolCall {
  requestId: string
  serverId: string
  serverName: string
  toolName: string
  startTime: number
  endTime?: number
  status: 'running' | 'completed' | 'error'
  args?: Record<string, unknown>
  result?: unknown
  error?: string
  progress?: number // 0-100
}

export const useToolCallsStore = defineStore('toolCalls', () => {
  const calls = ref<Map<string, ToolCall>>(new Map())

  const runningCalls = computed(() =>
    Array.from(calls.value.values()).filter(c => c.status === 'running')
  )

  // 添加或更新调用
  function updateCall(call: ToolCall) {
    calls.value.set(call.requestId, call)
  }

  // 获取调用
  function getCall(requestId: string): ToolCall | undefined {
    return calls.value.get(requestId)
  }

  // 完成调用
  function completeCall(requestId: string, result: unknown, error?: string) {
    const call = calls.value.get(requestId)
    if (call) {
      call.status = error ? 'error' : 'completed'
      call.endTime = Date.now()
      call.result = error ? undefined : result
      call.error = error
    }
  }

  // 处理工具调用开始事件
  function handleToolCallStarted(data: any) {
    updateCall({
      requestId: data.requestId,
      serverId: data.serverId,
      serverName: data.serverName,
      toolName: data.toolName,
      startTime: data.timestamp,
      status: 'running',
      args: data.args,
      progress: 0
    })
  }

  // 处理工具调用完成事件
  function handleToolCallCompleted(data: any) {
    completeCall(data.requestId, data.result)
  }

  // 处理工具调用错误事件
  function handleToolCallError(data: any) {
    completeCall(data.requestId, undefined, data.error)
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
  }
})
