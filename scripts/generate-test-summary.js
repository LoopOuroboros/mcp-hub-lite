#!/usr/bin/env node

/**
 * 生成测试结果摘要文件
 * 读取 Vitest 生成的 JSON 报告并创建简洁的摘要
 */

import fs from 'fs';
import path from 'path';

// 确保 logs 目录存在
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// 读取后端测试结果
let backendResults = null;
try {
  const backendJsonPath = path.join(logsDir, 'test-backend-results.json');
  if (fs.existsSync(backendJsonPath)) {
    const backendData = fs.readFileSync(backendJsonPath, 'utf8');
    backendResults = JSON.parse(backendData);
  }
} catch (error) {
  console.error('Failed to read backend test results:', error);
}

// 读取前端测试结果
let frontendResults = null;
try {
  const frontendJsonPath = path.join(logsDir, 'test-frontend-results.json');
  if (fs.existsSync(frontendJsonPath)) {
    const frontendData = fs.readFileSync(frontendJsonPath, 'utf8');
    frontendResults = JSON.parse(frontendData);
  }
} catch (error) {
  console.error('Failed to read frontend test results:', error);
}

// 计算汇总统计
let totalFiles = 0;
let passedFiles = 0;
let totalTests = 0;
let passedTests = 0;
let startTime = null;
let endTime = null;

// 处理后端结果
if (backendResults && backendResults.testResults) {
  const backendTestResults = backendResults.testResults;
  totalFiles += backendTestResults.length;
  passedFiles += backendTestResults.filter(result => result.status === 'passed').length;

  let backendTotalTests = 0;
  let backendPassedTests = 0;

  backendTestResults.forEach(file => {
    if (file.assertionResults) {
      backendTotalTests += file.assertionResults.length;
      backendPassedTests += file.assertionResults.filter(test => test.status === 'passed').length;
    }
  });

  totalTests += backendTotalTests;
  passedTests += backendPassedTests;

  // 获取时间信息
  if (backendResults.startTime) {
    startTime = new Date(backendResults.startTime);
  }
  if (backendResults.endTime) {
    endTime = new Date(backendResults.endTime);
  }
}

// 处理前端结果
if (frontendResults && frontendResults.testResults) {
  const frontendTestResults = frontendResults.testResults;
  totalFiles += frontendTestResults.length;
  passedFiles += frontendTestResults.filter(result => result.status === 'passed').length;

  let frontendTotalTests = 0;
  let frontendPassedTests = 0;

  frontendTestResults.forEach(file => {
    if (file.assertionResults) {
      frontendTotalTests += file.assertionResults.length;
      frontendPassedTests += file.assertionResults.filter(test => test.status === 'passed').length;
    }
  });

  totalTests += frontendTotalTests;
  passedTests += frontendPassedTests;

  // 更新时间信息
  if (frontendResults.startTime && (!startTime || frontendResults.startTime < startTime.getTime())) {
    startTime = new Date(frontendResults.startTime);
  }
  if (frontendResults.endTime && (!endTime || frontendResults.endTime > endTime.getTime())) {
    endTime = new Date(frontendResults.endTime);
  }
}

// 计算持续时间
let durationMs = 0;
if (startTime && endTime) {
  durationMs = endTime.getTime() - startTime.getTime();
}

// 格式化持续时间
const formatDuration = (ms) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const milliseconds = ms % 1000;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}.${String(milliseconds).padStart(3, '0')}s`;
  } else {
    return `${seconds}.${String(milliseconds).padStart(3, '0')}s`;
  }
};

// 生成摘要内容
const summaryContent = `
 Test Files  ${passedFiles} passed (${totalFiles})
      Tests  ${passedTests} passed (${totalTests})
   Start at  ${startTime ? startTime.toISOString().replace('T', ' ').substring(0, 19) : 'Unknown'}
   Duration  ${formatDuration(durationMs)}
`;

// 写入摘要文件
const summaryPath = path.join(logsDir, 'test-summary.log');
fs.writeFileSync(summaryPath, summaryContent.trim());

console.log(`Test summary saved to ${summaryPath}`);