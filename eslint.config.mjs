import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';

export default [
  {
    files: ['**/*.{js,mjs,cjs,ts,vue}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    }
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    rules: {
      // 严格禁止 any（包括测试文件）
      '@typescript-eslint/no-explicit-any': 'error',
      // 允许 @ts-expect-error 但需要注释
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': 'allow-with-description',
          'ts-nocheck': true,
          'ts-check': false,
          minimumDescriptionLength: 5
        }
      ]
    }
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser }
    }
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'poc/**',
      'docs/**',
      'tests/temp/**',
      'logs/**',
      'pids/**',
      '.vscode/**',
      '.idea/**',
      '.trea/**',
      '.DS_Store',
      'Thumbs.db',
      '*.log',
      '*.pid',
      '*.seed',
      '*.pid.lock',
      '*.tgz',
      '.cache/',
      'tmp/',
      'temp/',
      'test/temp/',
      '.env',
      '.env.local',
      '.env.development.local',
      '.env.test.local',
      '.env.production.local',
      '.mcp-hub.json',
      'mcp-hub-config.json',
      'test-config.json',
      '*.backup',
      '*.bak',
      '.mcp-hub.backup/',
      'process-logs/',
      '.claude/',
      '.specify/',
      'docs/kaizen/',
      'docs/img/',
      'docs/plans/',
      '*.zip',
      '*.tar.gz'
    ]
  }
];
