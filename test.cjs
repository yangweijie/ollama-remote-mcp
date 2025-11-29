#!/usr/bin/env node

/**
 * 简单的 MCP 工具测试脚本
 */

const { execSync } = require('child_process');

// 简单的颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function testConnection() {
  log('\n🔌 测试 Ollama 连接...', colors.blue);
  
  try {
    // 测试本地 Ollama 连接
    const curl = require('child_process').execSync;
    const result = curl('curl -s http://localhost:11434/api/tags', { encoding: 'utf8' });
    const data = JSON.parse(result);
    
    log('✅ Ollama 连接成功', colors.green);
    log(`📋 发现 ${data.models?.length || 0} 个模型:`, colors.blue);
    
    if (data.models && data.models.length > 0) {
      data.models.forEach((model, index) => {
        const size = formatSize(model.size || 0);
        log(`  ${index + 1}. ${model.name} (${size})`, colors.reset);
      });
    } else {
      log('  ⚠️  没有找到可用的模型', colors.yellow);
      log('  💡 提示: 运行 "ollama pull llama3.2" 下载一个模型', colors.yellow);
    }
    
    return true;
  } catch (error) {
    log('❌ Ollama 连接失败', colors.red);
    log('💡 请确保 Ollama 服务器正在运行 (ollama serve)', colors.yellow);
    return false;
  }
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function testBuild() {
  log('\n🔨 测试构建过程...', colors.blue);
  
  try {
    execSync('npm run build', { stdio: 'inherit' });
    log('✅ 构建成功', colors.green);
    return true;
  } catch (error) {
    log('❌ 构建失败', colors.red);
    return false;
  }
}

function testStart() {
  log('\n🚀 测试 MCP 服务器启动...', colors.blue);
  
  try {
    // 尝试启动服务器，等待5秒后退出
    const startProcess = execSync('timeout 5 node dist/index.js', { encoding: 'utf8' });
    log('✅ MCP 服务器启动成功', colors.green);
    return true;
  } catch (error) {
    if (error.status === 124) {
      // timeout 退出码，服务器正常启动
      log('✅ MCP 服务器启动成功 (正常运行5秒)', colors.green);
      return true;
    }
    log('❌ MCP 服务器启动失败', colors.red);
    log(`错误: ${error.message}`, colors.red);
    return false;
  }
}

function showHelp() {
  log('🔧 Ollama Remote MCP 测试工具', colors.blue);
  log('================================\n', colors.blue);
  
  log('📖 使用方法:', colors.yellow);
  log('  npm test                    # 运行所有测试', colors.reset);
  log('  npm run test:connection     # 只测试连接', colors.reset);
  log('  npm run test:build          # 只测试构建', colors.reset);
  log('  npm run test:start          # 只测试启动', colors.reset);
  
  log('\n🔧 手动测试命令:', colors.yellow);
  log('  node test.cjs connection    # 测试连接', colors.reset);
  log('  node test.cjs build         # 测试构建', colors.reset);
  log('  node test.cjs start         # 测试启动', colors.reset);
  log('  node test.cjs all           # 运行所有测试', colors.reset);
}

function main() {
  const args = process.argv.slice(2);
  
  log('🔧 Ollama Remote MCP 测试工具', colors.blue);
  log('================================\n', colors.blue);
  
  if (args.length === 0 || args.includes('all')) {
    // 运行所有测试
    const connectionOk = testConnection();
    if (connectionOk) {
      testBuild();
      testStart();
    }
    log('\n🎉 测试完成!', colors.green);
  } else if (args.includes('connection')) {
    testConnection();
  } else if (args.includes('build')) {
    testBuild();
  } else if (args.includes('start')) {
    testStart();
  } else if (args.includes('help')) {
    showHelp();
  } else {
    showHelp();
  }
}

// 运行主函数
if (require.main === module) {
  main();
}
