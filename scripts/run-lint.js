#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'logs', 'lint.log');

function runEslintCheck() {
    try {
        // 确保 logs 目录存在
        if (!fs.existsSync(path.dirname(LOG_FILE))) {
            fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
        }

        // 运行 eslint 检查
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

        // 检查日志文件是否为空
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

        // 正则匹配: line:col severity message rule_id(optional)
        // 示例: 617:20  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
        const regex = /^\s*(\d+):(\d+)\s+(error|warning)\s+(.+?)(?:\s{2,}(.*))?$/;

        for (const line of lines) {
            // 移除行首尾空白
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            const match = line.match(regex);
            if (match) {
                // 只提取 message 字段（索引为4）
                const message = match[4];

                // 清理 message (去除多余空白)
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

        // 按出现次数降序排序
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
            // 格式化输出，保持对齐
            summary += `${count.toString().padEnd(6)}| ${msg}\n`;
        }
        summary += '=================================================================\n';

        // 追加到日志文件末尾
        fs.appendFileSync(LOG_FILE, summary);
        console.log(`Analysis successfully appended to ${LOG_FILE}`);

        // 同时也输出到控制台以便查看
        console.log(summary);

    } catch (error) {
        console.error('Error analyzing lint log:', error);
    }
}

// 执行完整流程
runEslintCheck();
analyzeLintLog();
