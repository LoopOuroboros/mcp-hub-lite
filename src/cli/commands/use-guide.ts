import { Command } from 'commander';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { getConfigManager } from '@config/config-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const USE_GUIDE_PATH_ZH = join(__dirname, '../../services/hub-tools/use-guide-zh.md');
const USE_GUIDE_PATH_EN = join(__dirname, '../../services/hub-tools/use-guide-en.md');

function loadUseGuideContent(): string {
  let language = 'en';
  try {
    const configManager = getConfigManager();
    const config = configManager.getConfig();
    language = config.system.language;
  } catch {
    // Config not available, use default English
  }

  const path = language === 'zh' ? USE_GUIDE_PATH_ZH : USE_GUIDE_PATH_EN;
  try {
    return fs.readFileSync(path, 'utf-8');
  } catch {
    return '# MCP Hub Lite Use Guide\n\nThe use guide is currently unavailable.\n';
  }
}

export const useGuideCommand = new Command('use-guide')
  .description('Output usage guide in Markdown format')
  .action(() => {
    process.stdout.write(loadUseGuideContent());
    process.exit(0);
  });
