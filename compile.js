#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

console.log('Starting TypeScript compilation...');

try {
  // 使用 bun 编译
  const cmd = 'bun build src/index.ts --outdir dist --target node --external @modelcontextprotocol/sdk --external zod';
  console.log(`Running: ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: __dirname });
  console.log('✓ Compilation completed successfully');
} catch (error) {
  console.error('✗ Compilation failed:', error.message);
  process.exit(1);
}
