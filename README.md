# Ollama Remote MCP

一个基于Model Context Protocol (MCP) 的Ollama远程访问实现。

## 项目概述

本项目实现了一个MCP服务器，提供对Ollama AI模型的远程访问能力。通过MCP协议，可以安全地与远程Ollama实例进行交互。

## 技术栈

- **TypeScript** - 类型安全的JavaScript
- **Model Context Protocol (MCP) SDK** - 标准化的上下文协议实现
- **Zod** - TypeScript优先的schema验证库
- **Node.js** - 运行时环境

## 安装

```bash
# 安装依赖
npm install
```

## 构建

```bash
# 编译TypeScript
npm run build
```

## 使用

### 开发模式

```bash
# 编译并运行
npm run build
npm start
```

### 直接运行

```bash
npm start
```

## 项目结构

```
ollama-remote-mcp/
├── src/                 # TypeScript源文件
├── dist/                # 编译后的JavaScript文件
├── tsconfig.json        # TypeScript配置
├── package.json         # 项目配置和依赖
└── README.md           # 项目文档
```

## 功能特性

- 基于MCP标准的远程模型访问
- 类型安全的接口设计
- 完整的错误处理和验证
- 支持远程Ollama实例连接

## trae 使用
~~~ json
{
  "mcpServers": {
    "remote-ollama": {
      "command": "npx",
      "args": [
        "ollama-remote-mcp"
      ],
      "env": {
        "OLLAMA_BASE_URL": "https://ollama.com",
        "OLLAMA_API_KEY": "实际api_key"
      }
    }
  }
}
~~~

## 开发

### 开发依赖

- `typescript`: TypeScript编译器
- `@types/node`: Node.js类型定义

### 生产依赖

- `@modelcontextprotocol/sdk`: MCP SDK实现
- `@cfworker/json-schema`: JSON Schema支持
- `zod`: 数据验证

## 许可证

MIT
