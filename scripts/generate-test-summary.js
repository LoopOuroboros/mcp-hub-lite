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
let failedFiles = 0;
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let startTime = null;
let endTime = null;
const failedFileList = [];
const failedTestDetails = [];

// 处理后端结果
if (backendResults && backendResults.testResults) {
  const backendTestResults = backendResults.testResults;
  totalFiles += backendTestResults.length;
  passedFiles += backendTestResults.filter((result) => result.status === 'passed').length;
  failedFiles += backendTestResults.filter((result) => result.status === 'failed').length;

  let backendTotalTests = 0;
  let backendPassedTests = 0;
  let backendFailedTests = 0;
  let backendMaxEndTime = 0;

  backendTestResults.forEach((file) => {
    if (file.endTime > backendMaxEndTime) {
      backendMaxEndTime = file.endTime;
    }

    if (file.assertionResults) {
      backendTotalTests += file.assertionResults.length;
      backendPassedTests += file.assertionResults.filter((test) => test.status === 'passed').length;
      backendFailedTests += file.assertionResults.filter((test) => test.status === 'failed').length;

      // 收集失败的测试详情
      const failedAssertions = file.assertionResults.filter((test) => test.status === 'failed');
      if (failedAssertions.length > 0) {
        failedFileList.push(file.name);
        failedAssertions.forEach((test) => {
          failedTestDetails.push({
            file: file.name,
            test: test.title,
            error: test.failureMessages?.[0] || 'Unknown error'
          });
        });
      }
    }
  });

  totalTests += backendTotalTests;
  passedTests += backendPassedTests;
  failedTests += backendFailedTests;

  // 获取时间信息
  if (backendResults.startTime) {
    startTime = new Date(backendResults.startTime);
  }
  if (backendResults.endTime) {
    endTime = new Date(backendResults.endTime);
  } else if (backendMaxEndTime > 0) {
    endTime = new Date(backendMaxEndTime);
  }
}

// 处理前端结果
if (frontendResults && frontendResults.testResults) {
  const frontendTestResults = frontendResults.testResults;
  totalFiles += frontendTestResults.length;
  passedFiles += frontendTestResults.filter((result) => result.status === 'passed').length;
  failedFiles += frontendTestResults.filter((result) => result.status === 'failed').length;

  let frontendTotalTests = 0;
  let frontendPassedTests = 0;
  let frontendFailedTests = 0;
  let frontendMaxEndTime = 0;

  frontendTestResults.forEach((file) => {
    if (file.endTime > frontendMaxEndTime) {
      frontendMaxEndTime = file.endTime;
    }

    if (file.assertionResults) {
      frontendTotalTests += file.assertionResults.length;
      frontendPassedTests += file.assertionResults.filter(
        (test) => test.status === 'passed'
      ).length;
      frontendFailedTests += file.assertionResults.filter(
        (test) => test.status === 'failed'
      ).length;

      // 收集失败的测试详情
      const failedAssertions = file.assertionResults.filter((test) => test.status === 'failed');
      if (failedAssertions.length > 0) {
        failedFileList.push(file.name);
        failedAssertions.forEach((test) => {
          failedTestDetails.push({
            file: file.name,
            test: test.title,
            error: test.failureMessages?.[0] || 'Unknown error'
          });
        });
      }
    }
  });

  totalTests += frontendTotalTests;
  passedTests += frontendPassedTests;
  failedTests += frontendFailedTests;

  // 更新时间信息
  if (
    frontendResults.startTime &&
    (!startTime || frontendResults.startTime < startTime.getTime())
  ) {
    startTime = new Date(frontendResults.startTime);
  }

  const currentFrontendEndTime = frontendResults.endTime
    ? new Date(frontendResults.endTime)
    : frontendMaxEndTime > 0
      ? new Date(frontendMaxEndTime)
      : null;

  if (
    currentFrontendEndTime &&
    (!endTime || currentFrontendEndTime.getTime() > endTime.getTime())
  ) {
    endTime = currentFrontendEndTime;
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

// 格式化日期为 ISO 9075 (YYYY-MM-DD HH:MM:SS) - 使用本地时间
const formatDate = (date) => {
  const pad = (n) => n.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// 生成摘要内容
let summaryContent = `
 Test Files  ${passedFiles} passed, ${failedFiles} failed (${totalFiles} total)
      Tests  ${passedTests} passed, ${failedTests} failed (${totalTests} total)
   Start at  ${startTime ? formatDate(startTime) : 'Unknown'}
   Duration  ${formatDuration(durationMs)}
`;

// 添加失败文件列表（如果有）
if (failedFileList.length > 0) {
  summaryContent += `
 Failed Files:
`;
  // 去重并添加失败文件
  const uniqueFailedFiles = [...new Set(failedFileList)];
  uniqueFailedFiles.forEach((file) => {
    summaryContent += `  - ${file}\n`;
  });
}

// 添加失败测试详情（如果有）
if (failedTestDetails.length > 0) {
  summaryContent += `
 Failed Tests:
`;
  failedTestDetails.forEach((test) => {
    summaryContent += `  - ${test.test} (${test.file})\n`;
    // 只显示错误消息的前几行，避免摘要过长
    const errorLines = test.error.split('\n').slice(0, 2);
    errorLines.forEach((line) => {
      if (line.trim()) {
        summaryContent += `    ${line.trim()}\n`;
      }
    });
  });
}

// 写入摘要文件
const summaryPath = path.join(logsDir, 'test-summary.log');
fs.writeFileSync(summaryPath, summaryContent.trim());

console.log(`Test summary saved to ${summaryPath}`);

// 同时打印摘要内容到控制台
console.log('\n' + summaryContent);
