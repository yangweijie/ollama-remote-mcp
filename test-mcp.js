#!/usr/bin/env node

/**
 * MCP 服务器测试脚本
 * 用于测试 Ollama Remote MCP 工具功能
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class MCPTester {
  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    this.process = null;
  }

  // 启动MCP服务器
  async startServer() {
    try {
      console.log('🚀 启动 Ollama Remote MCP 服务器...');
      this.process = exec('node dist/index.js');
      
      // 等待服务器启动
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('✅ MCP 服务器已启动');
      return true;
    } catch (error) {
      console.error('❌ 启动服务器失败:', error.message);
      return false;
    }
  }

  // 停止MCP服务器
  stopServer() {
    if (this.process) {
      this.process.kill();
      console.log('🛑 MCP 服务器已停止');
    }
  }

  // 测试模型列表功能
  async testListModels() {
    console.log('\n📋 测试 list_ollama_models 工具...');
    
    try {
      // 模拟MCP工具调用
      const testRequest = {
        method: "tools/list",
        params: {}
      };

      console.log('📤 发送请求:', JSON.stringify(testRequest, null, 2));
      
      // 这里我们直接测试 Ollama API
      const response = await fetch(`${this.baseUrl}/api/tags`);
      
      if (!response.ok) {
        console.log(`❌ Ollama API 错误: ${response.status} ${response.statusText}`);
        return false;
      }

      const data = await response.json();
      const models = data.models || [];

      console.log(`✅ 成功获取 ${models.length} 个模型:`);
      
      models.forEach((model, index) => {
        console.log(`${index + 1}. ${model.name} (${this.formatSize(model.size)})`);
      });

      return true;
    } catch (error) {
      console.error('❌ 测试失败:', error.message);
      return false;
    }
  }

  // 测试对话功能
  async testChat(model = 'llama3.2:latest', message = '你好') {
    console.log(`\n💬 测试 chat_with_remote_ollama 工具...`);
    console.log(`📝 使用模型: ${model}`);
    console.log(`💭 测试消息: ${message}`);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'user', content: message }
          ],
          stream: false,
          options: {
            temperature: 0.7
          }
        })
      });

      if (!response.ok) {
        console.log(`❌ Ollama API 错误: ${response.status} ${response.statusText}`);
        return false;
      }

      const data = await response.json();
      const reply = data.message?.content || "No content returned";

      console.log('✅ 对话测试成功!');
      console.log('🤖 响应:', reply);
      
      return true;
    } catch (error) {
      console.error('❌ 对话测试失败:', error.message);
      return false;
    }
  }

  // 测试连接
  async testConnection() {
    console.log('\n🔌 测试 Ollama 连接...');
    
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET'
      });

      if (response.ok) {
        console.log('✅ Ollama 服务器连接成功');
        return true;
      } else {
        console.log(`❌ Ollama 服务器响应错误: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.error('❌ 无法连接到 Ollama 服务器:', error.message);
      console.log('💡 请确保 Ollama 服务器正在运行 (ollama serve)');
      return false;
    }
  }

  // 格式化文件大小
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // 运行完整测试
  async runFullTest() {
    console.log('🧪 开始 MCP 工具测试\n');
    
    try {
      // 1. 测试连接
      const connected = await this.testConnection();
      if (!connected) {
        console.log('\n❌ 连接测试失败，无法继续测试');
        return;
      }

      // 2. 启动MCP服务器
      const serverStarted = await this.startServer();
      if (!serverStarted) {
        console.log('\n❌ 服务器启动失败');
        return;
      }

      // 3. 测试模型列表
      await this.testListModels();

      // 4. 测试对话功能
      await this.testChat();

      console.log('\n🎉 所有测试完成!');
      
    } catch (error) {
      console.error('\n💥 测试过程中发生错误:', error.message);
    } finally {
      this.stopServer();
    }
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const tester = new MCPTester();
  
  console.log('🔧 Ollama Remote MCP 测试工具');
  console.log('================================\n');

  if (args.includes('--help') || args.includes('-h')) {
    console.log('📖 使用方法:');
    console.log('  node test-mcp.js --full          # 运行完整测试');
    console.log('  node test-mcp.js --test-connection # 只测试连接');
    console.log('  node test-mcp.js --test-models    # 测试模型列表');
    console.log('  node test-mcp.js --test-chat      # 测试对话功能');
    console.log('  node test-mcp.js --test-chat --model=llama3.2:latest --message="你好" # 自定义参数');
    return;
  }

  if (args.includes('--full') || args.length === 0) {
    // 运行完整测试
    await tester.runFullTest();
  } else if (args.includes('--test-connection')) {
    await tester.testConnection();
  } else if (args.includes('--test-models')) {
    const connected = await tester.testConnection();
    if (connected) {
      await tester.testListModels();
    }
  } else if (args.includes('--test-chat')) {
    const connected = await tester.testConnection();
    if (connected) {
      const model = args.find(arg => arg.startsWith('--model='))?.split('=')[1] || 'llama3.2:latest';
      const message = args.find(arg => arg.startsWith('--message='))?.split('=')[1] || '你好';
      await tester.testChat(model, message);
    }
  } else {
    console.log('📖 使用方法:');
    console.log('  node test-mcp.js --full          # 运行完整测试');
    console.log('  node test-mcp.js --test-connection # 只测试连接');
    console.log('  node test-mcp.js --test-models    # 测试模型列表');
    console.log('  node test-mcp.js --test-chat      # 测试对话功能');
    console.log('  node test-mcp.js --test-chat --model=llama3.2:latest --message="你好" # 自定义参数');
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default MCPTester;