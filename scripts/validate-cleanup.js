#!/usr/bin/env node

/**
 * MCP Hub Lite 清理验证脚本
 * 验证方案三的所有清理任务是否正确完成
 */

const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

function logSuccess(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function logError(message) {
  console.error(`${colors.red}✗ ${message}${colors.reset}`);
}

function logWarning(message) {
  console.warn(`${colors.yellow}⚠ ${message}${colors.reset}`);
}

// 验证函数
function validateFileExists(filePath, description) {
  try {
    if (fs.existsSync(filePath)) {
      logSuccess(`${description} 存在`);
      return true;
    } else {
      logError(`${description} 不存在: ${filePath}`);
      return false;
    }
  } catch (error) {
    logError(`检查 ${description} 时出错: ${error.message}`);
    return false;
  }
}

function validateFileNotExists(filePath, description) {
  try {
    if (!fs.existsSync(filePath)) {
      logSuccess(`${description} 已正确删除`);
      return true;
    } else {
      logError(`${description} 仍然存在: ${filePath}`);
      return false;
    }
  } catch (error) {
    logError(`检查 ${description} 时出错: ${error.message}`);
    return false;
  }
}

function validateImportReferences(filePath, expectedImports) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let allFound = true;

    for (const importPath of expectedImports) {
      if (content.includes(importPath)) {
        logSuccess(`在 ${path.basename(filePath)} 中找到预期的导入: ${importPath}`);
      } else {
        logError(`在 ${path.basename(filePath)} 中未找到预期的导入: ${importPath}`);
        allFound = false;
      }
    }
    return allFound;
  } catch (error) {
    logError(`检查 ${path.basename(filePath)} 导入时出错: ${error.message}`);
    return false;
  }
}

// 主验证函数
async function runValidation() {
  console.log('🚀 开始 MCP Hub Lite 清理验证...\n');

  let allPassed = true;

  // 1. 验证 POC 目录清理
  console.log('📋 验证任务 1: POC 目录和全局配置清理');
  allPassed &= validateFileNotExists(
    path.join(__dirname, '..', 'poc'),
    'POC 目录'
  );

  // 2. 验证文件命名约定
  console.log('\n📋 验证任务 2: 文件命名约定标准化');

  // 路由文件
  const routeFiles = [
    'server-routes.ts',
    'mcp-routes.ts',
    'health-routes.ts'
  ];

  for (const file of routeFiles) {
    allPassed &= validateFileExists(
      path.join(__dirname, '..', 'src', 'api', 'routes', file),
      `路由文件 ${file}`
    );
  }

  // 验证旧文件不存在
  const oldRouteFiles = [
    'server.routes.ts',
    'mcp.routes.ts',
    'health.routes.ts'
  ];

  for (const file of oldRouteFiles) {
    allPassed &= validateFileNotExists(
      path.join(__dirname, '..', 'src', 'api', 'routes', file),
      `旧路由文件 ${file}`
    );
  }

  // Store 文件
  allPassed &= validateFileExists(
    path.join(__dirname, '..', 'frontend', 'src', 'stores', 'server-store.ts'),
    'Store 文件 server-store.ts'
  );

  allPassed &= validateFileNotExists(
    path.join(__dirname, '..', 'frontend', 'src', 'stores', 'server.store.ts'),
    '旧 Store 文件 server.store.ts'
  );

  // 3. 验证测试结构
  console.log('\n📋 验证任务 3: 测试结构整合');

  const testDirs = [
    'tests/unit/models',
    'tests/unit/services',
    'tests/unit/utils',
    'tests/integration/api',
    'tests/integration/gateway',
    'tests/e2e/dashboard'
  ];

  for (const dir of testDirs) {
    allPassed &= validateFileExists(
      path.join(__dirname, '..', dir),
      `测试目录 ${dir}`
    );
  }

  // 4. 验证配置管理清理
  console.log('\n📋 验证任务 4: 配置管理清理');

  allPassed &= validateFileExists(
    path.join(__dirname, '..', 'src', 'config', 'config-manager.ts'),
    '合并后的配置管理文件'
  );

  allPassed &= validateFileNotExists(
    path.join(__dirname, '..', 'src', 'config', 'config.schema.ts'),
    '旧配置 schema 文件'
  );

  allPassed &= validateFileNotExists(
    path.join(__dirname, '..', 'src', 'config', 'config.manager.ts'),
    '旧配置管理器文件'
  );

  // 5. 验证导入引用更新
  console.log('\n📋 验证任务 5: 导入引用更新');

  // 验证 app.ts 中的路由导入
  allPassed &= validateImportReferences(
    path.join(__dirname, '..', 'src', 'app.ts'),
    [
      './api/routes/server-routes.js',
      './api/routes/mcp-routes.js',
      './api/routes/health-routes.js'
    ]
  );

  // 验证前端组件中的 store 导入
  allPassed &= validateImportReferences(
    path.join(__dirname, '..', 'frontend', 'src', 'components', 'ServerManager.vue'),
    ['./stores/server-store.js']
  );

  allPassed &= validateImportReferences(
    path.join(__dirname, '..', 'frontend', 'src', 'components', 'ToolExplorer.vue'),
    ['./stores/server-store.js']
  );

  // 6. 验证 .gitignore 配置
  console.log('\n📋 验证 .gitignore 配置');
  try {
    const gitignoreContent = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
    if (!gitignoreContent.includes('specs/')) {
      logSuccess('.gitignore 正确配置 - specs/ 目录被跟踪');
    } else {
      logError('.gitignore 配置错误 - specs/ 目录被忽略');
      allPassed = false;
    }
  } catch (error) {
    logError('读取 .gitignore 时出错');
    allPassed = false;
  }

  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log(`${colors.green}🎉 所有清理验证通过！方案三实施成功！${colors.reset}`);
    console.log('\n✅ 项目现在具有:');
    console.log('   • 简化的文件结构');
    console.log('   • 标准化的命名约定');
    console.log('   • 整合的测试架构');
    console.log('   • 精简的配置管理');
    console.log('   • 正确的文档跟踪');
    process.exit(0);
  } else {
    console.log(`${colors.red}❌ 部分验证失败，请检查上述错误${colors.reset}`);
    process.exit(1);
  }
}

// 运行验证
runValidation().catch(error => {
  console.error('验证脚本执行出错:', error);
  process.exit(1);
});