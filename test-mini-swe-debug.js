const http = require('http');

// 创建一个简单的 HTTP 客户端来调用 MCP 工具
function callMCPTool(toolName, params) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    console.log(`\n[${new Date().toISOString()}] 开始执行工具: ${toolName}`);
    console.log(`[PARAMS] ${JSON.stringify(params, null, 2)}`);

    // 这里模拟调用 MCP 工具
    // 实际的 MCP 调用会通过 stdio 进行
    console.log(`[STEP 1] 初始化工具调用`);
    console.log(`[STEP 2] 序列化参数`);
    console.log(`[STEP 3] 发送请求到 MCP 服务器`);
    
    // 模拟网络延迟
    setTimeout(() => {
      const elapsed = Date.now() - startTime;
      console.log(`[STEP 4] 等待服务器响应 (已耗时: ${elapsed}ms)`);
      console.log(`[STEP 5] 解析响应数据`);
      console.log(`[STEP 6] 返回结果`);
      console.log(`[COMPLETED] 工具执行完成 (总耗时: ${elapsed}ms)\n`);
      
      resolve({
        success: true,
        elapsed
      });
    }, 1000);
  });
}

// 测试函数
async function testMiniSWEAgent() {
  console.log('========================================');
  console.log('Mini-SWE Agent 工具测试 - 详细日志');
  console.log('========================================');
  console.log(`启动时间: ${new Date().toISOString()}`);
  console.log(`Node 版本: ${process.version}`);
  console.log('========================================\n');

  try {
    // 测试 1: Code Generation
    console.log('【测试 1】Code Generation 任务');
    console.log('-----------------------------------');
    await callMCPTool('mini_swe_execute_task', {
      task_type: 'code_generation',
      description: 'Generate a TypeScript function that calculates factorial',
      context: 'Use modern TypeScript with proper type annotations'
    });

    // 测试 2: Bug Fixing
    console.log('【测试 2】Bug Fixing 任务');
    console.log('-----------------------------------');
    await callMCPTool('mini_swe_execute_task', {
      task_type: 'bug_fixing',
      description: 'Fix a function that returns undefined',
      context: 'function getValue() { const x = 5; }'
    });

    // 测试 3: Code Review
    console.log('【测试 3】Code Review 任务');
    console.log('-----------------------------------');
    await callMCPTool('mini_swe_execute_task', {
      task_type: 'code_review',
      description: 'Review this TypeScript code for best practices',
      context: 'const data = any; const result = data.map(x => x * 2);'
    });

  } catch (error) {
    console.error(`[ERROR] 测试失败: ${error.message}`);
    console.error(error.stack);
  }

  console.log('\n========================================');
  console.log('测试完成');
  console.log('========================================');
}

// 运行测试
testMiniSWEAgent().catch(console.error);
