# Design Document: Mini-SWE Agent

## Overview

The Mini-SWE Agent is an intelligent task orchestration system that automatically selects and executes software engineering tasks using the most appropriate remote Ollama model. The system analyzes task characteristics (domain, complexity, required capabilities) and leverages a model profile registry to make informed selection decisions. It integrates seamlessly with the existing Ollama Remote MCP infrastructure to provide unified access to diverse model capabilities.

The architecture follows a modular, layered design with clear separation of concerns:
- **Task Analysis Layer**: Parses and characterizes incoming tasks
- **Model Selection Layer**: Evaluates and scores available models
- **Execution Layer**: Orchestrates task execution with fallback handling
- **Result Formatting Layer**: Structures and returns execution results

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
                           ↓
                  Ollama Remote MCP
                  (Existing Infrastructure)
```

## Components and Interfaces

### 1. Task Parser Component

**Responsibility**: Parse and validate incoming task requests, extract task characteristics.

**Interface**:
```typescript
interface TaskParserInput {
  description: string;
  context?: string;
  taskType?: string;
}

interface ParsedTask {
  description: string;
  domain: string; // 'code', 'math', 'reasoning', 'multimodal', 'general'
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  requiredCapabilities: string[]; // e.g., ['code_generation', 'tool_use', 'reasoning']
  contextSize: number;
  taskType: string; // 'code_generation', 'bug_fixing', 'code_review', 'test_writing', 'documentation', 'architecture_analysis', 'general'
}

function parseTask(input: TaskParserInput): ParsedTask | ValidationError
```

### 2. Model Profile Registry Component

**Responsibility**: Manage model profiles, load from configuration, verify availability.

**Interface**:
```typescript
interface ModelProfile {
  name: string;
  provider: string;
  domains: string[]; // Areas of expertise
  maxComplexity: 'simple' | 'moderate' | 'complex' | 'expert';
  capabilities: string[]; // e.g., ['code_generation', 'tool_use', 'reasoning', 'multimodal']
  contextWindow: number;
  estimatedLatency: number; // milliseconds
  costPerToken: number;
  strengths: string[];
  weaknesses: string[];
  available: boolean;
}

interface ModelRegistry {
  profiles: Map<string, ModelProfile>;
  loadProfiles(configPath: string): Promise<void>;
  verifyAvailability(): Promise<void>;
  getProfile(modelName: string): ModelProfile | null;
  getAllProfiles(): ModelProfile[];
  getAvailableProfiles(): ModelProfile[];
}
```

### 3. Model Selector Component

**Responsibility**: Score and select the best model for a given task.

**Interface**:
```typescript
interface ModelScore {
  modelName: string;
  score: number; // 0-100
  domainMatch: number;
  complexityMatch: number;
  capabilityMatch: number;
  contextMatch: number;
  latencyScore: number;
  justification: string;
}

interface SelectionResult {
  selectedModel: string;
  score: ModelScore;
  alternatives: ModelScore[];
  reasoning: string;
}

function selectModel(task: ParsedTask, registry: ModelRegistry): SelectionResult | Error
```

**Scoring Algorithm**:
- Domain Match (30%): How well the model's expertise aligns with task domain
- Complexity Match (25%): Whether model can handle task complexity level
- Capability Match (25%): Percentage of required capabilities the model has
- Context Match (10%): Whether model's context window accommodates task context
- Latency Score (10%): Preference for faster models when scores are close

### 4. Task Executor Component

**Responsibility**: Execute tasks using selected model, handle failures and fallbacks.

**Interface**:
```typescript
interface ExecutionRequest {
  task: ParsedTask;
  modelName: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

interface ExecutionResult {
  success: boolean;
  modelUsed: string;
  response: string;
  executionTime: number;
  tokensUsed: number;
  confidence: number;
  metadata: Record<string, any>;
}

interface ExecutionError {
  modelAttempted: string;
  error: string;
  timestamp: number;
}

async function executeTask(
  request: ExecutionRequest,
  ollamaClient: OllamaRemoteMCP
): Promise<ExecutionResult | ExecutionError[]>
```

**Fallback Strategy**:
1. Execute with primary model
2. If failure, attempt next-best model from alternatives
3. Continue until success or all models exhausted
4. Return comprehensive error report if all fail

### 5. Result Formatter Component

**Responsibility**: Format execution results and metadata into structured output.

**Interface**:
```typescript
interface FormattedResult {
  task: ParsedTask;
  execution: {
    modelUsed: string;
    executionTime: number;
    tokensUsed: number;
    confidence: number;
  };
  selection: {
    selectedModel: string;
    justification: string;
    alternatives: ModelScore[];
  };
  result: {
    response: string;
    metadata: Record<string, any>;
  };
  logs: ExecutionLog[];
}

interface ExecutionLog {
  timestamp: number;
  step: string;
  details: Record<string, any>;
}

function formatResult(
  task: ParsedTask,
  selection: SelectionResult,
  execution: ExecutionResult,
  logs: ExecutionLog[]
): FormattedResult
```

### 6. System Prompt Generator Component

**Responsibility**: Generate task-specific system prompts optimized for selected model.

**Interface**:
```typescript
interface SystemPromptConfig {
  taskType: string;
  modelName: string;
  domain: string;
  context?: string;
}

function generateSystemPrompt(config: SystemPromptConfig): string
```

**Task-Specific Prompts**:
- Code Generation: Focus on correctness, best practices, documentation
- Bug Fixing: Emphasize root cause analysis, testing, verification
- Code Review: Highlight security, performance, maintainability concerns
- Test Writing: Stress comprehensive coverage, edge cases, clarity
- Documentation: Require clarity, examples, completeness
- Architecture Analysis: Focus on scalability, maintainability, trade-offs

## Data Models

### Task Representation
```typescript
interface Task {
  id: string;
  description: string;
  context?: string;
  taskType: string;
  domain: string;
  complexity: string;
  requiredCapabilities: string[];
  contextSize: number;
  createdAt: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}
```

### Model Profile Storage
```typescript
interface ModelProfileConfig {
  models: {
    [modelName: string]: {
      provider: string;
      domains: string[];
      maxComplexity: string;
      capabilities: string[];
      contextWindow: number;
      estimatedLatency: number;
      costPerToken: number;
      strengths: string[];
      weaknesses: string[];
    }
  }
}
```

### Execution Trace
```typescript
interface ExecutionTrace {
  taskId: string;
  taskDescription: string;
  taskCharacteristics: ParsedTask;
  modelSelection: {
    selectedModel: string;
    scores: ModelScore[];
    reasoning: string;
  };
  execution: {
    modelUsed: string;
    startTime: number;
    endTime: number;
    duration: number;
    tokensUsed: number;
    success: boolean;
    response: string;
    errors?: ExecutionError[];
  };
  logs: ExecutionLog[];
}
```

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Task Validation Completeness
*For any* task input, if the task description is empty or contains only whitespace, the system SHALL reject the task and return a validation error.

**Validates: Requirements 1.4**

### Property 2: Task Parsing Consistency
*For any* valid task description, parsing the task SHALL produce a structured task object containing all required fields: description, domain, complexity level, and required capabilities.

**Validates: Requirements 1.3**

### Property 3: Model Selection Determinism
*For any* parsed task and fixed model registry, selecting a model SHALL always produce the same selected model (deterministic behavior).

**Validates: Requirements 2.1, 2.3**

### Property 4: Model Scoring Validity
*For any* parsed task and available models, the scoring algorithm SHALL assign scores between 0-100 to each model, with the selected model having the highest score.

**Validates: Requirements 2.2**

### Property 5: Fallback Execution Resilience
*For any* task execution where the primary model fails, the system SHALL attempt execution with the next-best model before returning an error.

**Validates: Requirements 4.4**

### Property 6: Result Metadata Completeness
*For any* successful task execution, the returned result object SHALL include all required metadata: model used, execution time, tokens used, and confidence score.

**Validates: Requirements 5.2**

### Property 7: Model Profile Validation
*For any* model profile loaded from configuration, the profile SHALL contain all required fields: name, domain expertise, complexity level, capabilities, and performance characteristics.

**Validates: Requirements 6.2**

### Property 8: Error Handling Comprehensiveness
*For any* task execution failure, the system SHALL return a structured error response with error type, message, and recovery suggestions.

**Validates: Requirements 7.2**

### Property 9: Execution Log Completeness
*For any* task execution, the system SHALL generate execution logs recording task parsing, model selection process, and execution steps with timestamps.

**Validates: Requirements 8.2, 8.3**

### Property 10: Context Window Awareness
*For any* task with context size exceeding a model's context window, the system SHALL either select a model with sufficient context window or truncate context intelligently before execution.

**Validates: Requirements 10.3, 10.4**

### Property 11: Task Type Support
*For any* task type submitted (code generation, bug fixing, code review, test writing, documentation, architecture analysis), the system SHALL use task-type-specific system prompts optimized for that type.

**Validates: Requirements 9.2**

### Property 12: Selection Justification Transparency
*For any* model selection, the system SHALL provide justification including matching criteria, model strengths relevant to the task, and alternative models considered.

**Validates: Requirements 3.2, 3.3, 3.4**

## Error Handling

### Error Categories

1. **Validation Errors**
   - Empty or whitespace-only task descriptions
   - Invalid task types
   - Missing required fields
   - Context exceeding maximum size

2. **Configuration Errors**
   - Invalid model profiles
   - Missing configuration files
   - Malformed profile data

3. **Availability Errors**
   - No models available
   - All configured models unavailable
   - Ollama Remote MCP unreachable

4. **Execution Errors**
   - Model execution timeout
   - Model API errors
   - Network failures
   - Context window exceeded

5. **Fallback Exhaustion**
   - All fallback models failed
   - No alternative models available

### Error Recovery Strategy

```
Input Validation Error
  ↓
Return validation error with suggestions
  ↓
(User corrects input)

Configuration Error
  ↓
Log error, skip problematic model
  ↓
Continue with available models

Availability Error
  ↓
Return error indicating no suitable models
  ↓
Suggest checking Ollama Remote MCP connection

Execution Error (Primary Model)
  ↓
Attempt fallback model
  ↓
If fallback succeeds: return result
  ↓
If fallback fails: try next alternative
  ↓
If all fail: return comprehensive error report
```

## Testing Strategy

### Unit Testing Approach

Unit tests verify specific examples, edge cases, and error conditions:

- **Task Parser Tests**: Validate parsing of various task descriptions, edge cases (empty strings, whitespace, special characters)
- **Model Selector Tests**: Test scoring algorithm with different task characteristics and model profiles
- **System Prompt Generator Tests**: Verify task-type-specific prompt generation
- **Result Formatter Tests**: Ensure correct JSON structure and metadata inclusion
- **Error Handler Tests**: Validate error message formatting and recovery suggestions

### Property-Based Testing Approach

Property-based tests verify universal properties that should hold across all inputs using a PBT library (e.g., fast-check for TypeScript):

- **Property 1**: Task validation rejects empty/whitespace inputs
- **Property 2**: Task parsing produces complete structured output
- **Property 3**: Model selection is deterministic
- **Property 4**: Model scores are valid (0-100 range)
- **Property 5**: Fallback execution attempts alternative models
- **Property 6**: Result metadata is complete
- **Property 7**: Model profiles contain required fields
- **Property 8**: Error responses are structured correctly
- **Property 9**: Execution logs contain required information
- **Property 10**: Context window constraints are respected
- **Property 11**: Task-type-specific prompts are generated
- **Property 12**: Selection justification is provided

### Testing Configuration

- **Minimum iterations**: 100 per property-based test
- **Test framework**: fast-check (TypeScript) or equivalent
- **Coverage target**: All correctness properties implemented as separate PBT tests
- **Test organization**: Co-located with source files using `.test.ts` suffix

### Test Execution

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run property-based tests only
npm run test:properties

# Run specific test file
npm test -- src/components/taskParser.test.ts
```

## Integration Points

### Ollama Remote MCP Integration

The system integrates with the existing Ollama Remote MCP through:

1. **Model Listing**: Query available models via `list_ollama_models` tool
2. **Task Execution**: Send task to model via `chat_with_remote_ollama` tool
3. **Error Handling**: Handle MCP-specific errors and timeouts

### Configuration Integration

- Load model profiles from YAML/JSON configuration files
- Support environment variable overrides
- Validate configuration on startup

### Logging Integration

- Structured logging with timestamps
- Log levels: DEBUG, INFO, WARN, ERROR
- Exportable execution traces for debugging

## Deployment Considerations

### Environment Variables

```
MINI_SWE_CONFIG_PATH=./config/models.yaml
MINI_SWE_LOG_LEVEL=INFO
MINI_SWE_MAX_CONTEXT_SIZE=128000
MINI_SWE_FALLBACK_TIMEOUT=30000
MINI_SWE_OLLAMA_TIMEOUT=60000
```

### Configuration File Structure

```yaml
models:
  deepseek-v3.2:
    provider: ollama
    domains: [code, math, reasoning]
    maxComplexity: expert
    capabilities: [code_generation, tool_use, reasoning, math]
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

  qwen3-coder:
    provider: ollama
    domains: [code]
    maxComplexity: expert
    capabilities: [code_generation, tool_use, testing]
    contextWindow: 256000
    estimatedLatency: 3000
    costPerToken: 0.00008
    strengths:
      - Code generation
      - Terminal automation
      - Test writing
    weaknesses:
      - Mathematical reasoning
      - Non-code tasks
```

## Future Enhancements

1. **Learning from Execution**: Track model performance over time and adjust scoring
2. **Cost Optimization**: Consider cost-per-token in model selection
3. **Parallel Execution**: Execute multiple models in parallel for comparison
4. **User Feedback Loop**: Allow users to rate model selections and improve scoring
5. **Custom Model Profiles**: Allow users to define custom model profiles
6. **Caching**: Cache task results for identical or similar tasks
7. **Streaming Results**: Stream model responses for long-running tasks
8. **Multi-Language Support**: Support non-English task descriptions
