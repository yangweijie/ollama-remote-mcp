# Mini-SWE Agent

An intelligent task automation system that automatically selects the most appropriate Ollama model to complete software engineering tasks.

## Features

- **Automatic Model Selection**: Analyzes task characteristics (domain, complexity, capabilities) and selects the best model
- **Task Type Support**: Code generation, bug fixing, code review, test writing, documentation, and architecture analysis
- **Fallback Mechanism**: Automatically tries alternative models if the primary model fails
- **Intelligent Scoring**: Uses a weighted scoring algorithm considering domain match, complexity, capabilities, context window, and latency
- **Comprehensive Logging**: Detailed execution logs for debugging and analysis
- **MCP Integration**: Exposed as an MCP tool for seamless integration with Claude Desktop and other MCP clients

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Mini-SWE Agent System                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Task Input & Validation Layer              │   │
│  │  - Accept task description and optional context      │   │
│  │  - Validate input completeness                       │   │
│  │  - Parse task characteristics                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │        Model Selection & Scoring Layer               │   │
│  │  - Load model profiles from configuration            │   │
│  │  - Score models against task characteristics         │   │
│  │  - Select optimal model with justification           │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │      Task Execution & Fallback Layer                 │   │
│  │  - Execute task via Ollama Remote MCP                │   │
│  │  - Handle execution failures                         │   │
│  │  - Attempt fallback models on failure                │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │      Result Formatting & Logging Layer               │   │
│  │  - Capture execution metadata                        │   │
│  │  - Format results as structured JSON                 │   │
│  │  - Generate execution logs and traces                │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Components

1. **Task Parser**: Analyzes task description and extracts characteristics (domain, complexity, capabilities)
2. **Model Registry**: Manages model profiles and availability
3. **Model Selector**: Scores and selects the best model using a weighted algorithm
4. **System Prompt Generator**: Creates task-specific prompts optimized for each model
5. **Task Executor**: Executes tasks with timeout and fallback handling
6. **Result Formatter**: Structures results with metadata and logs
7. **Execution Logger**: Provides detailed logging for debugging

## Model Selection Algorithm

The system uses a weighted scoring algorithm (0-100 scale):

- **Domain Match (30%)**: How well the model's expertise aligns with task domain
- **Complexity Match (25%)**: Whether model can handle task complexity level
- **Capability Match (25%)**: Percentage of required capabilities the model has
- **Context Match (10%)**: Whether model's context window accommodates task context
- **Latency Score (10%)**: Preference for faster models when scores are close

## Configuration

Model profiles are configured in `config/models.yaml`:

```yaml
models:
  deepseek-v3.2:
    provider: ollama
    domains:
      - code
      - math
      - reasoning
    maxComplexity: expert
    capabilities:
      - code_generation
      - tool_use
      - reasoning
      - math
    contextWindow: 128000
    estimatedLatency: 5000
    costPerToken: 0.0001
    strengths:
      - Complex reasoning
      - Mathematical proofs
      - Code analysis
    weaknesses:
      - Real-time constraints
      - Very large contexts
```

## Usage

### As MCP Tool

Use the `mini_swe_execute_task` tool in Claude Desktop or any MCP client:

```json
{
  "name": "mini_swe_execute_task",
  "arguments": {
    "description": "Write a TypeScript function to calculate factorial",
    "task_type": "code_generation"
  }
}
```

### Programmatic Usage

```typescript
import { MiniSWEAgent } from './mini-swe-agent/MiniSWEAgent.js';
import { OllamaRemoteMCPClient } from './mini-swe-agent/OllamaRemoteMCPClient.js';

const ollamaClient = new OllamaRemoteMCPClient();
const agent = new MiniSWEAgent({
  configPath: './config/models.yaml',
  ollamaClient,
  logLevel: 'INFO',
});

await agent.initialize();

const result = await agent.executeTask({
  description: 'Write a function to sort an array',
  taskType: 'code_generation',
});

console.log(result.result.response);
```

### Running Examples

```bash
# Build the project
npm run build

# Run basic usage example
node dist/examples/basic-usage.js
```

## Environment Variables

- `OLLAMA_BASE_URL`: Ollama server URL (default: `http://localhost:11434`)
- `OLLAMA_API_KEY`: Optional API key for authentication
- `MINI_SWE_CONFIG_PATH`: Path to model configuration file
- `MINI_SWE_LOG_LEVEL`: Log level (DEBUG, INFO, WARN, ERROR)
- `MINI_SWE_TIMEOUT`: Execution timeout in milliseconds (default: 60000)

## Task Types

- `code_generation`: Generate new code
- `bug_fixing`: Fix bugs in existing code
- `code_review`: Review and analyze code quality
- `test_writing`: Write unit tests
- `documentation`: Create documentation
- `architecture_analysis`: Analyze system architecture
- `general`: General software engineering tasks

## Project Structure

```
ollama-remote-mcp/
├── src/
│   ├── types/              # TypeScript type definitions
│   │   └── index.ts
│   ├── components/         # Core components
│   │   ├── TaskParser.ts
│   │   ├── ModelRegistry.ts
│   │   ├── ModelSelector.ts
│   │   ├── SystemPromptGenerator.ts
│   │   ├── TaskExecutor.ts
│   │   ├── ResultFormatter.ts
│   │   └── ExecutionLogger.ts
│   ├── mini-swe-agent/    # Main orchestrator
│   │   ├── MiniSWEAgent.ts
│   │   └── OllamaRemoteMCPClient.ts
│   └── index.ts           # MCP server entry point
├── config/
│   └── models.yaml        # Model profiles configuration
├── examples/
│   └── basic-usage.ts     # Usage examples
└── .kiro/
    └── specs/
        └── mini-swe-agent/
            ├── requirements.md
            ├── design.md
            └── tasks.md
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run MCP server
npm start

# Run tests
npm test
```

## License

MIT
