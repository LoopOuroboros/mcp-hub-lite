#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'logs', 'lint.log');

function runEslintCheck() {
  try {
    // Ensure logs directory exists
    if (!fs.existsSync(path.dirname(LOG_FILE))) {
      fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    }

    // Run eslint check
    console.log('Running eslint check...');
    execSync('npx eslint . --no-color --format stylish --output-file logs/lint.log', {
      encoding: 'utf8',
      stdio: 'inherit'
    });
  } catch {
    console.log('eslint check completed with errors');
  }
}

function analyzeLintLog() {
  try {
    console.log(`Analyzing log file: ${LOG_FILE}`);

    if (!fs.existsSync(LOG_FILE)) {
      console.error(`Log file not found: ${LOG_FILE}`);
      return;
    }

    const content = fs.readFileSync(LOG_FILE, 'utf-8');

    // Check if log file is empty
    if (!content.trim()) {
      let summary = '\n\n=================================================================\n';
      summary += `LINT ANALYSIS REPORT (${new Date().toLocaleString()})\n`;
      summary += '=================================================================\n';
      summary += 'No lint issues found (log file is empty).\n';
      summary += 'All files passed linting checks.\n';
      summary += '=================================================================\n';

      fs.appendFileSync(LOG_FILE, summary);
      console.log(`Analysis successfully appended to ${LOG_FILE}`);
      console.log(summary);
      return;
    }

    const lines = content.split('\n');

    const messageCounts = new Map();
    let totalIssues = 0;

    // Regex pattern: line:col severity message rule_id(optional)
    // Example: 617:20  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
    const regex = /^\s*(\d+):(\d+)\s+(error|warning)\s+(.+?)(?:\s{2,}(.*))?$/;

    for (const line of lines) {
      // Remove leading and trailing whitespace
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      const match = line.match(regex);
      if (match) {
        // Extract only the message field (index 4)
        const message = match[4];

        // Clean message (remove extra whitespace)
        const cleanMessage = message.trim();

        const count = messageCounts.get(cleanMessage) || 0;
        messageCounts.set(cleanMessage, count + 1);
        totalIssues++;
      }
    }

    if (totalIssues === 0) {
      console.log('No lint issues found to analyze.');
      return;
    }

    // Sort by occurrence count in descending order
    const sortedStats = [...messageCounts.entries()].sort((a, b) => b[1] - a[1]);

    let summary = '\n\n=================================================================\n';
    summary += `LINT ANALYSIS REPORT (${new Date().toLocaleString()})\n`;
    summary += '=================================================================\n';
    summary += `Total Issues Found: ${totalIssues}\n\n`;
    summary += 'Top Issues by Message:\n';
    summary += '-----------------------------------------------------------------\n';
    summary += 'Count | Message\n';
    summary += '------+----------------------------------------------------------\n';

    for (const [msg, count] of sortedStats) {
      // Format output to maintain alignment
      summary += `${count.toString().padEnd(6)}| ${msg}\n`;
    }
    summary += '=================================================================\n';

    // Append to the end of the log file
    fs.appendFileSync(LOG_FILE, summary);
    console.log(`Analysis successfully appended to ${LOG_FILE}`);

    // Also output to console for viewing
    console.log(summary);
  } catch (error) {
    console.error('Error analyzing lint log:', error);
  }
}

// Execute complete process
runEslintCheck();
analyzeLintLog();
