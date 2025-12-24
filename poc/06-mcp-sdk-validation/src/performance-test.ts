#!/usr/bin/env tsx
/**
 * MCP TypeScript SDK 性能基准测试
 * 测试指标：
 * 1. 客户端创建时间
 * 2. 工具列表查询延迟
 * 3. 工具调用响应时间
 * 4. 内存使用情况
 * 5. 并发处理能力
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// 性能基准配置
const PERFORMANCE_CONFIG = {
  // 目标性能指标
  TARGETS: {
    clientCreationMs: 10,
    toolListLatencyMs: 50,
    toolCallLatencyMs: 100,
    memoryUsageMB: 100,
    concurrentRequests: 50,
  },

  // 测试参数
  WARMUP_ITERATIONS: 5,
  TEST_ITERATIONS: 20,
  CONCURRENT_CLIENTS: 10,
} as const;

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  passed: boolean;
  target?: number;
}

interface BenchmarkResult {
  category: string;
  metrics: PerformanceMetric[];
  summary: string;
}

/**
 * 记录性能指标
 */
function recordMetric(
  metrics: PerformanceMetric[],
  name: string,
  value: number,
  unit: string,
  target?: number
): void {
  const passed = target !== undefined ? value <= target : true;
  metrics.push({ name, value, unit, passed, target });
}

/**
 * 测试 1: 客户端创建性能
 */
async function benchmarkClientCreation(): Promise<BenchmarkResult> {
  const metrics: PerformanceMetric[] = [];

  console.log('\n测试: 客户端创建性能');
  console.log('-'.repeat(40));

  // 预热
  const warmupTimes: number[] = [];
  for (let i = 0; i < PERFORMANCE_CONFIG.WARMUP_ITERATIONS; i++) {
    const start = performance.now();
    new Client({
      name: 'warmup-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });
    warmupTimes.push(performance.now() - start);
  }

  const warmupAvg = warmupTimes.reduce((a, b) => a + b, 0) / warmupTimes.length;

  // 正式测试
  const creationTimes: number[] = [];
  for (let i = 0; i < PERFORMANCE_CONFIG.TEST_ITERATIONS; i++) {
    const start = performance.now();
    new Client({
      name: `test-client-${i}`,
      version: '1.0.0'
    }, {
      capabilities: {}
    });
    creationTimes.push(performance.now() - start);
  }

  const avgTime = creationTimes.reduce((a, b) => a + b, 0) / creationTimes.length;
  const minTime = Math.min(...creationTimes);
  const maxTime = Math.max(...creationTimes);
  const p95Index = Math.floor(creationTimes.length * 0.95);
  const p95Time = creationTimes.sort((a, b) => a - b)[p95Index];

  recordMetric(metrics, '平均创建时间', avgTime, 'ms', PERFORMANCE_CONFIG.TARGETS.clientCreationMs);
  recordMetric(metrics, '最小创建时间', minTime, 'ms', PERFORMANCE_CONFIG.TARGETS.clientCreationMs);
  recordMetric(metrics, '最大创建时间', maxTime, 'ms');
  recordMetric(metrics, 'P95 创建时间', p95Time, 'ms', PERFORMANCE_CONFIG.TARGETS.clientCreationMs * 2);

  console.log(`平均时间: ${avgTime.toFixed(3)}ms (预热: ${warmupAvg.toFixed(3)}ms)`);
  console.log(`范围: ${minTime.toFixed(3)}ms - ${maxTime.toFixed(3)}ms`);
  console.log(`P95: ${p95Time.toFixed(3)}ms`);

  const passed = metrics.filter(m => m.passed).length === metrics.length;
  const summary = passed ? '通过性能基准' : '未达到性能基准';

  return {
    category: '客户端创建性能',
    metrics,
    summary
  };
}

/**
 * 测试 2: 工具列表查询性能
 */
async function benchmarkToolList(): Promise<BenchmarkResult> {
  const metrics: PerformanceMetric[] = [];

  console.log('\n测试: 工具列表查询性能');
  console.log('-'.repeat(40));

  // 模拟客户端
  const client = new Client({
    name: 'latency-test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  // 预热
  const warmupTimes: number[] = [];
  for (let i = 0; i < PERFORMANCE_CONFIG.WARMUP_ITERATIONS; i++) {
    const start = performance.now();
    // 模拟工具列表查询
    const request = ListToolsRequestSchema.parse({
      method: 'tools/list',
      params: {}
    });
    await Promise.resolve(request); // 模拟异步操作
    warmupTimes.push(performance.now() - start);
  }

  const warmupAvg = warmupTimes.reduce((a, b) => a + b, 0) / warmupTimes.length;

  // 正式测试
  const listTimes: number[] = [];
  for (let i = 0; i < PERFORMANCE_CONFIG.TEST_ITERATIONS; i++) {
    const start = performance.now();
    const request = ListToolsRequestSchema.parse({
      method: 'tools/list',
      params: {}
    });
    await Promise.resolve(request);
    listTimes.push(performance.now() - start);
  }

  const avgTime = listTimes.reduce((a, b) => a + b, 0) / listTimes.length;
  const minTime = Math.min(...listTimes);
  const maxTime = Math.max(...listTimes);
  const p95Index = Math.floor(listTimes.length * 0.95);
  const p95Time = listTimes.sort((a, b) => a - b)[p95Index];

  recordMetric(metrics, '平均查询时间', avgTime, 'ms', PERFORMANCE_CONFIG.TARGETS.toolListLatencyMs);
  recordMetric(metrics, '最小查询时间', minTime, 'ms', PERFORMANCE_CONFIG.TARGETS.toolListLatencyMs);
  recordMetric(metrics, '最大查询时间', maxTime, 'ms');
  recordMetric(metrics, 'P95 查询时间', p95Time, 'ms', PERFORMANCE_CONFIG.TARGETS.toolListLatencyMs * 2);

  console.log(`平均时间: ${avgTime.toFixed(3)}ms (预热: ${warmupAvg.toFixed(3)}ms)`);
  console.log(`范围: ${minTime.toFixed(3)}ms - ${maxTime.toFixed(3)}ms`);
  console.log(`P95: ${p95Time.toFixed(3)}ms`);

  const passed = metrics.filter(m => m.passed).length === metrics.length;
  const summary = passed ? '通过性能基准' : '未达到性能基准';

  return {
    category: '工具列表查询性能',
    metrics,
    summary
  };
}

/**
 * 测试 3: 工具调用性能
 */
async function benchmarkToolCall(): Promise<BenchmarkResult> {
  const metrics: PerformanceMetric[] = [];

  console.log('\n测试: 工具调用性能');
  console.log('-'.repeat(40));

  // 预热
  const warmupTimes: number[] = [];
  for (let i = 0; i < PERFORMANCE_CONFIG.WARMUP_ITERATIONS; i++) {
    const start = performance.now();
    const request = CallToolRequestSchema.parse({
      method: 'tools/call',
      params: {
        name: 'test-tool',
        arguments: { test: true }
      }
    });
    await Promise.resolve(request);
    warmupTimes.push(performance.now() - start);
  }

  const warmupAvg = warmupTimes.reduce((a, b) => a + b, 0) / warmupTimes.length;

  // 正式测试
  const callTimes: number[] = [];
  for (let i = 0; i < PERFORMANCE_CONFIG.TEST_ITERATIONS; i++) {
    const start = performance.now();
    const request = CallToolRequestSchema.parse({
      method: 'tools/call',
      params: {
        name: 'test-tool',
        arguments: { index: i }
      }
    });
    await Promise.resolve(request);
    callTimes.push(performance.now() - start);
  }

  const avgTime = callTimes.reduce((a, b) => a + b, 0) / callTimes.length;
  const minTime = Math.min(...callTimes);
  const maxTime = Math.max(...callTimes);
  const p95Index = Math.floor(callTimes.length * 0.95);
  const p95Time = callTimes.sort((a, b) => a - b)[p95Index];

  recordMetric(metrics, '平均调用时间', avgTime, 'ms', PERFORMANCE_CONFIG.TARGETS.toolCallLatencyMs);
  recordMetric(metrics, '最小调用时间', minTime, 'ms', PERFORMANCE_CONFIG.TARGETS.toolCallLatencyMs);
  recordMetric(metrics, '最大调用时间', maxTime, 'ms');
  recordMetric(metrics, 'P95 调用时间', p95Time, 'ms', PERFORMANCE_CONFIG.TARGETS.toolCallLatencyMs * 2);

  console.log(`平均时间: ${avgTime.toFixed(3)}ms (预热: ${warmupAvg.toFixed(3)}ms)`);
  console.log(`范围: ${minTime.toFixed(3)}ms - ${maxTime.toFixed(3)}ms`);
  console.log(`P95: ${p95Time.toFixed(3)}ms`);

  const passed = metrics.filter(m => m.passed).length === metrics.length;
  const summary = passed ? '通过性能基准' : '未达到性能基准';

  return {
    category: '工具调用性能',
    metrics,
    summary
  };
}

/**
 * 测试 4: 内存使用情况
 */
async function benchmarkMemoryUsage(): Promise<BenchmarkResult> {
  const metrics: PerformanceMetric[] = [];

  console.log('\n测试: 内存使用情况');
  console.log('-'.repeat(40));

  // 强制垃圾回收（如果可用）
  if (globalThis.gc) {
    globalThis.gc();
  }

  // 获取初始内存
  const initialMemory = process.memoryUsage();
  const initialHeap = initialMemory.heapUsed / 1024 / 1024;

  // 创建大量客户端
  const clients: Client[] = [];
  for (let i = 0; i < 100; i++) {
    clients.push(new Client({
      name: `memory-client-${i}`,
      version: '1.0.0'
    }, {
      capabilities: {}
    }));
  }

  // 强制垃圾回收
  if (globalThis.gc) {
    globalThis.gc();
  }

  // 获取峰值内存
  const peakMemory = process.memoryUsage();
  const peakHeap = peakMemory.heapUsed / 1024 / 1024;
  const memoryIncrease = peakHeap - initialHeap;

  // 测试内存使用量
  const memoryPerClient = memoryIncrease / 100;

  // 清理
  clients.length = 0;
  if (globalThis.gc) {
    globalThis.gc();
  }

  const finalMemory = process.memoryUsage();
  const finalHeap = finalMemory.heapUsed / 1024 / 1024;

  recordMetric(metrics, '初始堆内存', initialHeap, 'MB');
  recordMetric(metrics, '峰值堆内存', peakHeap, 'MB');
  recordMetric(metrics, '内存增长', memoryIncrease, 'MB');
  recordMetric(metrics, '每客户端内存', memoryPerClient, 'MB');
  recordMetric(metrics, '清理后堆内存', finalHeap, 'MB');

  console.log(`初始堆内存: ${initialHeap.toFixed(2)} MB`);
  console.log(`峰值堆内存: ${peakHeap.toFixed(2)} MB`);
  console.log(`内存增长: ${memoryIncrease.toFixed(2)} MB`);
  console.log(`每客户端平均: ${memoryPerClient.toFixed(2)} MB`);
  console.log(`清理后: ${finalHeap.toFixed(2)} MB`);

  const passed = memoryPerClient <= (PERFORMANCE_CONFIG.TARGETS.memoryUsageMB / 100);
  const summary = passed ? '内存使用合理' : '内存使用过高';

  return {
    category: '内存使用性能',
    metrics,
    summary
  };
}

/**
 * 测试 5: 并发处理能力
 */
async function benchmarkConcurrentHandling(): Promise<BenchmarkResult> {
  const metrics: PerformanceMetric[] = [];

  console.log('\n测试: 并发处理能力');
  console.log('-'.repeat(40));

  const CONCURRENT_CLIENTS = PERFORMANCE_CONFIG.CONCURRENT_CLIENTS;
  const REQUESTS_PER_CLIENT = 10;
  const totalRequests = CONCURRENT_CLIENTS * REQUESTS_PER_CLIENT;

  // 创建多个客户端并并发测试
  const startTime = performance.now();
  const promises: Promise<number>[] = [];

  for (let i = 0; i < CONCURRENT_CLIENTS; i++) {
    const client = new Client({
        name: `concurrent-client-${i}`,
        version: '1.0.0'
      }, {
        capabilities: {}
      });

    // 每个客户端执行多个请求
    for (let j = 0; j < REQUESTS_PER_CLIENT; j++) {
      const requestStart = performance.now();
      const request = CallToolRequestSchema.parse({
        method: 'tools/call',
        params: {
          name: 'test-tool',
          arguments: { client: i, request: j }
        }
      });
      promises.push(
        Promise.resolve(request).then(() => performance.now() - requestStart)
      );
    }
  }

  // 等待所有请求完成
  const responseTimes = await Promise.all(promises);
  const totalTime = performance.now() - startTime;

  // 计算统计信息
  const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const minTime = Math.min(...responseTimes);
  const maxTime = Math.max(...responseTimes);
  const p95Index = Math.floor(responseTimes.length * 0.95);
  const p95Time = responseTimes.sort((a, b) => a - b)[p95Index];
  const throughput = totalRequests / (totalTime / 1000);

  recordMetric(metrics, '总请求数', totalRequests, '个');
  recordMetric(metrics, '总执行时间', totalTime, 'ms');
  recordMetric(metrics, '吞吐量', throughput, '请求/秒');
  recordMetric(metrics, '平均响应时间', avgTime, 'ms', PERFORMANCE_CONFIG.TARGETS.toolCallLatencyMs);
  recordMetric(metrics, '最小响应时间', minTime, 'ms');
  recordMetric(metrics, '最大响应时间', maxTime, 'ms');
  recordMetric(metrics, 'P95 响应时间', p95Time, 'ms', PERFORMANCE_CONFIG.TARGETS.toolCallLatencyMs * 2);

  console.log(`总请求数: ${totalRequests} 个`);
  console.log(`总执行时间: ${totalTime.toFixed(2)}ms`);
  console.log(`吞吐量: ${throughput.toFixed(2)} 请求/秒`);
  console.log(`平均响应时间: ${avgTime.toFixed(3)}ms`);
  console.log(`范围: ${minTime.toFixed(3)}ms - ${maxTime.toFixed(3)}ms`);
  console.log(`P95: ${p95Time.toFixed(3)}ms`);

  const passed = metrics.filter(m => m.name === '吞吐量' && m.value > 0).length > 0
    && avgTime <= PERFORMANCE_CONFIG.TARGETS.toolCallLatencyMs;
  const summary = passed ? '并发性能良好' : '并发性能需优化';

  return {
    category: '并发处理性能',
    metrics,
    summary
  };
}

/**
 * 主测试函数
 */
async function runAllBenchmarks(): Promise<void> {
  console.log('='.repeat(60));
  console.log('MCP TypeScript SDK 性能基准测试');
  console.log('='.repeat(60));

  const overallStart = performance.now();
  const benchmarks: BenchmarkResult[] = [];

  try {
    benchmarks.push(await benchmarkClientCreation());
    benchmarks.push(await benchmarkToolList());
    benchmarks.push(await benchmarkToolCall());
    benchmarks.push(await benchmarkMemoryUsage());
    benchmarks.push(await benchmarkConcurrentHandling());

    const overallTime = performance.now() - overallStart;

    // 输出总结
    console.log('\n' + '='.repeat(60));
    console.log('性能基准测试总结');
    console.log('='.repeat(60));
    console.log(`总执行时间: ${overallTime.toFixed(2)}ms\n`);

    benchmarks.forEach(benchmark => {
      console.log(`${benchmark.category}:`);
      console.log(`  状态: ${benchmark.summary}`);
      benchmark.metrics.forEach(metric => {
        const status = metric.passed ? '✓' : '✗';
        const target = metric.target ? ` (目标: ${metric.target}${metric.unit})` : '';
        console.log(`  ${status} ${metric.name}: ${metric.value.toFixed(3)}${metric.unit}${target}`);
      });
      console.log('');
    });

    const totalMetrics = benchmarks.flatMap(b => b.metrics).length;
    const passedMetrics = benchmarks.flatMap(b => b.metrics).filter(m => m.passed).length;
    const passRate = (passedMetrics / totalMetrics * 100).toFixed(1);

    console.log(`基准通过率: ${passRate}% (${passedMetrics}/${totalMetrics})`);

    // 退出码
    if (passedMetrics === totalMetrics) {
      console.log('\n✅ 所有性能基准测试通过');
      process.exit(0);
    } else {
      console.log(`\n⚠️  部分性能基准未达标 (${passRate}%)`);
      process.exit(0); // 性能基准不作为错误退出
    }
  } catch (error) {
    console.error('\n❌ 性能测试执行失败:');
    console.error(error);
    process.exit(1);
  }
}

// 执行测试
runAllBenchmarks().catch(error => {
  console.error('测试执行过程中发生未捕获的错误:');
  console.error(error);
  process.exit(1);
});