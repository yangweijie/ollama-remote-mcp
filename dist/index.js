#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
// 1. 获取配置 (优先使用环境变量)
// 在 Claude Desktop 配置文件中通过 env 传入
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || "";
// 创建 MCP 服务器实例
const server = new McpServer({
    name: "remote-ollama-mcp",
    version: "1.0.0",
});
// 2. 定义工具：让 Claude 可以调用远程 Ollama 模型
server.tool("chat_with_remote_ollama", "向远程 Ollama 服务器发送对话请求，支持自定义模型", {
    model: z.string().describe("要使用的模型名称，例如 'llama3', 'deepseek-coder'"),
    message: z.string().describe("发送给模型的提示词或问题"),
    system_prompt: z.string().optional().describe("可选的系统级指令"),
    temperature: z.number().optional().default(0.7).describe("模型温度，0-1之间")
}, async ({ model, message, system_prompt, temperature }) => {
    try {
        // 构建请求 URL
        const url = `${OLLAMA_BASE_URL.replace(/\/$/, "")}/api/chat`;
        // 构建请求头
        const headers = {
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
        const data = await response.json();
        const reply = data.message?.content || "No content returned";
        return {
            content: [
                {
                    type: "text",
                    text: reply,
                },
            ],
        };
    }
    catch (error) {
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
});
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
