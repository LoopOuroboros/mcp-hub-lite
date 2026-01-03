import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

const configDir = path.join(process.cwd(), 'config');
const PID_FILE = path.join(configDir, '.mcp-hub.pid');

export class PidManager {
  public static writePid(): void {
    try {
      // Ensure config directory exists
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(PID_FILE, process.pid.toString(), 'utf8');
      
      // Cleanup on exit
      process.on('exit', () => this.removePid());
      process.on('SIGINT', () => {
        this.removePid();
        process.exit();
      });
      process.on('SIGTERM', () => {
        this.removePid();
        process.exit();
      });
    } catch (error) {
      logger.error('Failed to write PID file:', error);
    }
  }

  public static removePid(): void {
    try {
      if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE);
      }
    } catch (error) {
        // Ignore errors on cleanup
    }
  }

  public static getPid(): number | null {
    try {
      if (fs.existsSync(PID_FILE)) {
        const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8'), 10);
        return isNaN(pid) ? null : pid;
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  public static isRunning(): boolean {
      const pid = this.getPid();
      if (!pid) return false;
      try {
          // process.kill(pid, 0) checks if process exists without killing it
          process.kill(pid, 0);
          return true;
      } catch (e) {
          return false;
      }
  }
}
