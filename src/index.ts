#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { MiniSWEAgent } from "./mini-swe-agent/MiniSWEAgent.js";
import { OllamaRemoteMCPClient } from "./mini-swe-agent/OllamaRemoteMCPClient.js";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 工具函数：格式化文件大小
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// 1. 获取配置 (优先使用环境变量)
// 在 Claude Desktop 配置文件中通过 env 传入
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || "";

// 创建 MCP 服务器实例
const server = new McpServer({
  name: "remote-ollama-mcp",
  version: "1.0.0",
});

// Initialize Mini-SWE Agent
const configPath = process.env.MINI_SWE_CONFIG_PATH || 
  path.join(__dirname, '../config/models.yaml');

const ollamaClient = new OllamaRemoteMCPClient(OLLAMA_BASE_URL, OLLAMA_API_KEY);
const miniSWEAgent = new MiniSWEAgent({
  configPath,
  ollamaClient,
  logLevel: (process.env.MINI_SWE_LOG_LEVEL as any) || 'INFO',
  timeout: parseInt(process.env.MINI_SWE_TIMEOUT || '60000'),
});

// 2. 定义工具：让 Claude 可以调用远程 Ollama 模型
// 2.1 工具：列出可用的 Ollama 模型
server.tool(
  "list_ollama_models",
  "列出远程 Ollama 服务器上所有可用的模型",
  {
    only_remote: z.boolean().optional().default(false).describe("只显示云端模型信息，默认显示所有模型")
  },
  async ({ only_remote }) => {
    try {
      // 构建请求 URL
      const url = `${OLLAMA_BASE_URL.replace(/\/$/, "")}/api/tags`;

      // 构建请求头
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // 如果配置了 API Key，添加到 Authorization Header
      if (OLLAMA_API_KEY) {
        headers["Authorization"] = `Bearer ${OLLAMA_API_KEY}`;
      }

      // 发送请求获取模型列表
      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Ollama API responded with status ${response.status}: ${response.statusText}`,
            },
          ],
          isError: true,
        };
      }

      const data = await response.json() as any;
      const models = data.models || [];

      if (models.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "当前 Ollama 服务器上没有可用的模型。\n\n您可以通过以下方式获取模型：\n1. 本地模型：使用 `ollama pull <模型名>` 下载模型\n2. 云端模型：配置 Ollama Cloud 账户或代理服务",
            },
          ],
        };
      }

      // 格式化模型列表
      const modelList = models.map((model: any) => {
        const name = model.name;
        const size = model.size;
        const modifiedAt = model.modified_at;
        
        // 检测是否为云端模型（一般云端模型会有特定的命名模式）
        const isRemoteModel = name.includes('cloud') || 
                             name.includes('online') || 
                             name.includes('api') ||
                             name.includes('remote') ||
                             name.includes('llama3') && name.includes(':') === false;
        
        return {
          name,
          size: formatSize(size),
          modifiedAt,
          isRemoteModel
        };
      });

      // 如果只显示云端模型，过滤结果
      const filteredModels = only_remote 
        ? modelList.filter((model: { isRemoteModel: boolean }) => model.isRemoteModel)
        : modelList;

      const displayModels = filteredModels.length > 0 ? filteredModels : modelList;

      // 生成格式化输出
      const modelListText = displayModels.map((model: any, index: number) => {
        const prefix = model.isRemoteModel ? "☁️ 云端" : "💾 本地";
        return `${index + 1}. **${prefix}** ${model.name}\n   - 大小: ${model.size}\n   - 更新时间: ${model.modifiedAt}`;
      }).join('\n\n');

      const summary = `🤖 Ollama 模型列表

总共有 ${models.length} 个可用模型${only_remote ? ' (仅显示云端模型)' : ''}:

${modelListText}`;

      return {
        content: [
          {
            type: "text",
            text: summary,
          },
        ],
      };

    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `连接失败: ${error.message}。请检查您的 OLLAMA_BASE_URL 和网络连接。`,
          },
        ],
        isError: true,
      };
    }
  }
);

// 2.2 工具：向远程 Ollama 发送对话请求
server.tool(
  "chat_with_remote_ollama",
  "向远程 Ollama 服务器发送对话请求，支持自定义模型",
  {
    model: z.string().describe("要使用的模型名称，例如 'llama3', 'deepseek-coder'"),
    message: z.string().describe("发送给模型的提示词或问题"),
    system_prompt: z.string().optional().describe("可选的系统级指令"),
    temperature: z.number().optional().default(0.7).describe("模型温度，0-1之间")
  },
  async ({ model, message, system_prompt, temperature }) => {

    try {
      // 构建请求 URL
      const url = `${OLLAMA_BASE_URL.replace(/\/$/, "")}/v1/chat/completions`;

      // 构建请求头
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // 如果配置了 API Key，添加到 Authorization Header
      // 适配大多数 Nginx Bearer Auth 或自定义 Auth
      if (OLLAMA_API_KEY) {
        headers["Authorization"] = `Bearer ${OLLAMA_API_KEY}`;
      }

      // 构建请求体
      const body = {
        model: model,
        messages: [
          ...(system_prompt ? [{ role: "system", content: system_prompt }] : []),
          { role: "user", content: message }
        ],
        stream: false, // MCP 工具通常需要一次性返回结果，关闭流式传输
        options: {
          temperature: temperature
        }
      };

      // 发送请求
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Ollama API responded with status ${response.status}: ${response.statusText}`,
            },
          ],
          isError: true,
        };
      }

      const data = await response.json() as any;
      const reply = data.choices?.[0]?.message?.content || "No content returned";
      console.error('[MCP DEBUG] Extracted reply:', reply);

      return {
        content: [
          {
            type: "text",
            text: reply,
          },
        ],
      };

    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Connection Failed: ${error.message}. Please check your OLLAMA_BASE_URL and connectivity.`,
          },
        ],
        isError: true,
      };
    }
  }
);

// 2.3 工具:Mini-SWE Agent - 智能任务执行
server.tool(
  "mini_swe_execute_task",
  "智能软件工程任务执行工具。自动选择最适合的模型来完成软件工程任务,支持代码生成、bug修复、代码审查、测试编写等任务类型。",
  {
    description: z.string().describe("任务描述,至少10个字符,详细说明要完成的任务"),
    context: z.string().optional().describe("可选的上下文信息,如代码片段、错误信息等"),
    task_type: z.string().optional().describe("可选的任务类型:code_generation, bug_fixing, code_review, test_writing, documentation, architecture_analysis"),
  },
  async ({ description, context, task_type }) => {
    try {
      // Execute task using Mini-SWE Agent
      const result = await miniSWEAgent.executeTask({
        description,
        context,
        taskType: task_type,
      });

      // Format result as text for better readability
      const formatter = new (await import('./components/ResultFormatter.js')).ResultFormatter();
      const textResult = formatter.toText(result);

      return {
        content: [
          {
            type: "text",
            text: textResult,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Mini-SWE Agent execution failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// 3. 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Remote Ollama MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
