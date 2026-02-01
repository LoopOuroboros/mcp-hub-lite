/**
 * 端口占用检查工具
 * 检查端口是否被占用，并尝试识别占用进程
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { PidManager } from '@pid/manager.js';

const execAsync = promisify(exec);

export interface PortCheckResult {
  inUse: boolean;
  pid?: number;
  processName?: string;
  commandLine?: string;
  isSelfProject?: boolean;
}

/**
 * 检查端口是否被占用
 */
export async function checkPort(port: number): Promise<PortCheckResult> {
  try {
    const platform = process.platform;

    if (platform === 'win32') {
      return await checkPortWindows(port);
    } else {
      return await checkPortUnix(port);
    }
  } catch (error) {
    // 检查失败时返回未占用（安全默认值）
    return { inUse: false };
  }
}

/**
 * Windows平台端口检查
 */
async function checkPortWindows(port: number): Promise<PortCheckResult> {
  try {
    // 使用netstat查找占用端口的进程
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);

    if (!stdout.trim()) {
      return { inUse: false };
    }

    // 解析netstat输出，提取PID
    const lines = stdout.trim().split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const localAddress = parts[1];
      const state = parts[3];
      const pid = parseInt(parts[4], 10);

      // 检查是否是LISTENING状态，且是目标端口
      if (state === 'LISTENING' && localAddress.endsWith(`:${port}`)) {
        // 获取进程详细信息
        const processInfo = await getProcessInfoWindows(pid);

        // 检查是否是本项目的进程
        const isSelfProject = await isSelfProjectProcess(pid, processInfo.commandLine);

        return {
          inUse: true,
          pid,
          processName: processInfo.processName,
          commandLine: processInfo.commandLine,
          isSelfProject
        };
      }
    }

    return { inUse: false };
  } catch (error) {
    return { inUse: false };
  }
}

/**
 * Unix平台端口检查 (Linux, macOS)
 */
async function checkPortUnix(port: number): Promise<PortCheckResult> {
  try {
    // 使用lsof查找占用端口的进程
    const { stdout } = await execAsync(`lsof -i :${port} -sTCP:LISTEN -t`);

    if (!stdout.trim()) {
      return { inUse: false };
    }

    const pid = parseInt(stdout.trim().split('\n')[0], 10);

    // 获取进程详细信息
    const processInfo = await getProcessInfoUnix(pid);

    // 检查是否是本项目的进程
    const isSelfProject = await isSelfProjectProcess(pid, processInfo.commandLine);

    return {
      inUse: true,
      pid,
      processName: processInfo.processName,
      commandLine: processInfo.commandLine,
      isSelfProject
    };
  } catch (error) {
    return { inUse: false };
  }
}

/**
 * 获取Windows进程信息
 */
async function getProcessInfoWindows(pid: number): Promise<{ processName: string; commandLine: string }> {
  try {
    // 使用wmic获取进程详细信息
    const { stdout } = await execAsync(
      `wmic process where ProcessId=${pid} get Name,CommandLine /format:list`
    );

    const lines = stdout.split('\n').filter(line => line.trim());
    let processName = 'Unknown';
    let commandLine = '';

    for (const line of lines) {
      if (line.startsWith('CommandLine=')) {
        commandLine = line.substring('CommandLine='.length).trim();
      } else if (line.startsWith('Name=')) {
        processName = line.substring('Name='.length).trim();
      }
    }

    return { processName, commandLine };
  } catch (error) {
    return { processName: 'Unknown', commandLine: '' };
  }
}

/**
 * 获取Unix进程信息
 */
async function getProcessInfoUnix(pid: number): Promise<{ processName: string; commandLine: string }> {
  try {
    // 使用ps获取进程详细信息
    const { stdout } = await execAsync(`ps -p ${pid} -o comm=,args=`);

    const parts = stdout.trim().split(/\s+/);
    const processName = parts[0] || 'Unknown';
    const commandLine = stdout.trim();

    return { processName, commandLine };
  } catch (error) {
    return { processName: 'Unknown', commandLine: '' };
  }
}

/**
 * 判断是否是本项目启动的进程
 */
async function isSelfProjectProcess(pid: number, commandLine: string): Promise<boolean> {
  // 检查1: 检查PID文件中记录的PID是否匹配
  const savedPid = PidManager.getPid();
  if (savedPid === pid) {
    return true;
  }

  // 检查2: 检查命令行是否包含项目特征
  if (!commandLine) {
    return false;
  }

  const projectSignatures = [
    'mcp-hub-lite',           // 项目名称
    'dist/server/src/index.js', // 编译后的入口文件
    'src/index.ts'            // 源代码入口文件
  ];

  return projectSignatures.some(signature => commandLine.includes(signature));
}
