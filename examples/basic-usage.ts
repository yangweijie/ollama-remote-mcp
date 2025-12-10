#!/usr/bin/env node
/**
 * Basic usage example for Mini-SWE Agent
 * 
 * This example demonstrates how to use the Mini-SWE Agent to execute
 * software engineering tasks with automatic model selection.
 */

import { MiniSWEAgent } from '../src/mini-swe-agent/MiniSWEAgent.js';
import { OllamaRemoteMCPClient } from '../src/mini-swe-agent/OllamaRemoteMCPClient.js';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  // 1. Create Ollama client
  const ollamaClient = new OllamaRemoteMCPClient(
    process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    process.env.OLLAMA_API_KEY
  );

  // 2. Test connection
  console.log('Testing connection to Ollama server...');
  const isConnected = await ollamaClient.testConnection();
  
  if (!isConnected) {
    console.error('Failed to connect to Ollama server. Please check your OLLAMA_BASE_URL.');
    process.exit(1);
  }
  console.log('✓ Connected to Ollama server\n');

  // 3. Create Mini-SWE Agent
  const configPath = path.join(__dirname, '../config/models.yaml');
  const agent = new MiniSWEAgent({
    configPath,
    ollamaClient,
    logLevel: 'INFO',
    timeout: 60000,
  });

  // 4. Initialize agent
  console.log('Initializing Mini-SWE Agent...');
  await agent.initialize();
  console.log('✓ Agent initialized\n');

  // 5. Execute a simple code generation task
  console.log('=== Example 1: Code Generation ===\n');
  
  const task1 = await agent.executeTask({
    description: 'Write a TypeScript function that calculates the factorial of a number using recursion',
    taskType: 'code_generation',
  });

  console.log('Task 1 Result:');
  console.log('Selected Model:', task1.selection.selectedModel);
  console.log('Execution Time:', task1.execution.executionTime + 'ms');
  console.log('Confidence:', task1.execution.confidence + '%');
  console.log('\nResponse:');
  console.log(task1.result.response);
  console.log('\n' + '='.repeat(60) + '\n');

  // 6. Execute a bug fixing task
  console.log('=== Example 2: Bug Fixing ===\n');
  
  const buggyCode = `
function add(a, b) {
  return a + b;
}

// This should return 10, but returns "55"
console.log(add(5, 5));
`;

  const task2 = await agent.executeTask({
    description: 'Fix the bug in this add function',
    context: buggyCode,
    taskType: 'bug_fixing',
  });

  console.log('Task 2 Result:');
  console.log('Selected Model:', task2.selection.selectedModel);
  console.log('Execution Time:', task2.execution.executionTime + 'ms');
  console.log('\nResponse:');
  console.log(task2.result.response);
  console.log('\n' + '='.repeat(60) + '\n');

  // 7. Print execution logs
  console.log('=== Execution Logs ===\n');
  console.log(agent.getLogs());
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
