#!/usr/bin/env node

/**
 * Generate test results summary file
 * Run complete tests and read Vitest-generated JSON report to create a concise summary
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function runBackendTests() {
  try {
    console.log('Running backend tests...');
    // Run backend silent tests
    execSync('npm run test:backend:silent', {
      encoding: 'utf8',
      stdio: 'inherit'
    });
    console.log('Backend tests completed successfully.');
  } catch {
    console.log('Backend tests completed with errors (this is expected if tests fail)');
  }
}

function runFrontendTests() {
  try {
    console.log('Running frontend tests...');
    // Run frontend silent tests
    execSync('npm run test:frontend:silent', {
      encoding: 'utf8',
      stdio: 'inherit'
    });
    console.log('Frontend tests completed successfully.');
  } catch {
    console.log('Frontend tests completed with errors (this is expected if tests fail)');
  }
}

function runFullTest() {
  // Run backend and frontend tests separately to ensure that even if one fails, the other will still execute
  runBackendTests();
  runFrontendTests();
  console.log('All tests execution completed.');
}

function generateTestSummary() {
  // Read backend test results
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

  // Read frontend test results
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

  // Calculate summary statistics
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

  // Process backend results
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
        backendPassedTests += file.assertionResults.filter(
          (test) => test.status === 'passed'
        ).length;
        backendFailedTests += file.assertionResults.filter(
          (test) => test.status === 'failed'
        ).length;

        // Collect details of failed tests
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

    // Get time information
    if (backendResults.startTime) {
      startTime = new Date(backendResults.startTime);
    }
    if (backendResults.endTime) {
      endTime = new Date(backendResults.endTime);
    } else if (backendMaxEndTime > 0) {
      endTime = new Date(backendMaxEndTime);
    }
  }

  // Process frontend results
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

        // Collect details of failed tests
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

    // Update time information
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

  // Calculate duration
  let durationMs = 0;
  if (startTime && endTime) {
    durationMs = endTime.getTime() - startTime.getTime();
  }

  // Format duration
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

  // Format date as ISO 9075 (YYYY-MM-DD HH:MM:SS) - using local time
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

  // Generate summary content
  let summaryContent = `
 Test Files  ${passedFiles} passed, ${failedFiles} failed (${totalFiles} total)
      Tests  ${passedTests} passed, ${failedTests} failed (${totalTests} total)
   Start at  ${startTime ? formatDate(startTime) : 'Unknown'}
   Duration  ${formatDuration(durationMs)}
`;

  // Add failed files list (if any)
  if (failedFileList.length > 0) {
    summaryContent += `
 Failed Files:
`;
    // Deduplicate and add failed files
    const uniqueFailedFiles = [...new Set(failedFileList)];
    uniqueFailedFiles.forEach((file) => {
      summaryContent += `  - ${file}\n`;
    });
  }

  // Add failed test details (if any)
  if (failedTestDetails.length > 0) {
    summaryContent += `
 Failed Tests:
`;
    failedTestDetails.forEach((test) => {
      summaryContent += `  - ${test.test} (${test.file})\n`;
      // Only show the first few lines of error messages to avoid overly long summaries
      const errorLines = test.error.split('\n').slice(0, 2);
      errorLines.forEach((line) => {
        if (line.trim()) {
          summaryContent += `    ${line.trim()}\n`;
        }
      });
    });
  }

  // Write to summary file
  const summaryPath = path.join(logsDir, 'test-summary.log');
  fs.writeFileSync(summaryPath, summaryContent.trim());

  console.log(`Test summary saved to ${summaryPath}`);

  // Also print summary content to console
  console.log('\n' + summaryContent);
}

// Execute complete process
runFullTest();
generateTestSummary();
