// Core Type Definitions for Mini-SWE Agent

// Task-related types
export interface TaskParserInput {
  description: string;
  context?: string;
  taskType?: string;
}

export type TaskDomain = 'code' | 'math' | 'reasoning' | 'multimodal' | 'general';
export type TaskComplexity = 'simple' | 'moderate' | 'complex' | 'expert';
export type TaskType = 'code_generation' | 'bug_fixing' | 'code_review' | 'test_writing' | 'documentation' | 'architecture_analysis' | 'general';

export interface ParsedTask {
  description: string;
  domain: TaskDomain;
  complexity: TaskComplexity;
  requiredCapabilities: string[];
  contextSize: number;
  taskType: TaskType;
}

export interface Task extends ParsedTask {
  id: string;
  context?: string;
  createdAt: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

// Model-related types
export interface ModelProfile {
  name: string;
  provider: string;
  domains: TaskDomain[];
  maxComplexity: TaskComplexity;
  capabilities: string[];
  contextWindow: number;
  estimatedLatency: number;
  costPerToken: number;
  strengths: string[];
  weaknesses: string[];
  available: boolean;
}

export interface ModelScore {
  modelName: string;
  score: number; // 0-100
  domainMatch: number;
  complexityMatch: number;
  capabilityMatch: number;
  contextMatch: number;
  latencyScore: number;
  justification: string;
}

export interface SelectionResult {
  selectedModel: string;
  score: ModelScore;
  alternatives: ModelScore[];
  reasoning: string;
}

// Execution-related types
export interface ExecutionRequest {
  task: ParsedTask;
  modelName: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ExecutionResult {
  success: boolean;
  modelUsed: string;
  response: string;
  executionTime: number;
  tokensUsed: number;
  confidence: number;
  metadata: Record<string, any>;
}

export interface ExecutionError {
  modelAttempted: string;
  error: string;
  timestamp: number;
}

// Result formatting types
export interface FormattedResult {
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

// Logging types
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface ExecutionLog {
  timestamp: number;
  level: LogLevel;
  step: string;
  details: Record<string, any>;
}

export interface ExecutionTrace {
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

// Configuration types
export interface SystemPromptConfig {
  taskType: TaskType;
  modelName: string;
  domain: TaskDomain;
  context?: string;
}

export interface ModelProfileConfig {
  models: {
    [modelName: string]: Omit<ModelProfile, 'name' | 'available'>;
  };
}

// Error types
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class AvailabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AvailabilityError';
  }
}

export class ExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutionError';
  }
}
