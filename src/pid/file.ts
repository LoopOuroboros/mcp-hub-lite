/**
 * PID文件操作工具
 * 职责：底层PID文件的读写删除操作
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import type { PidFileOptions } from './types.js';

// 配置目录：优先使用用户主目录下的 .mcp-hub-lite/config 文件夹
const DEFAULT_CONFIG_DIR = path.join(os.homedir(), '.mcp-hub-lite', 'config');
const DEFAULT_PID_FILENAME = '.mcp-hub.pid';

/**
 * 获取PID文件路径
 */
export function getPidFilePath(options?: PidFileOptions): string {
  const configDir = options?.configDir || DEFAULT_CONFIG_DIR;
  const filename = options?.filename || DEFAULT_PID_FILENAME;
  return path.join(configDir, filename);
}

/**
 * 写入PID文件
 */
export function writePidFile(pid: number, options?: PidFileOptions): void {
  const filePath = getPidFilePath(options);
  const configDir = path.dirname(filePath);

  // 确保配置目录存在
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(filePath, pid.toString(), 'utf8');
}

/**
 * 读取PID文件
 */
export function readPidFile(options?: PidFileOptions): number | null {
  try {
    const filePath = getPidFilePath(options);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const pid = parseInt(content.trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch (error) {
    return null;
  }
}

/**
 * 删除PID文件
 */
export function removePidFile(options?: PidFileOptions): void {
  try {
    const filePath = getPidFilePath(options);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    // 忽略删除错误
  }
}

/**
 * 检查PID文件是否存在
 */
export function pidFileExists(options?: PidFileOptions): boolean {
  const filePath = getPidFilePath(options);
  return fs.existsSync(filePath);
}
