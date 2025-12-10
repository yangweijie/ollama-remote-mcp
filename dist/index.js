#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// src/components/ResultFormatter.ts
var exports_ResultFormatter = {};
__export(exports_ResultFormatter, {
  ResultFormatter: () => ResultFormatter
});

class ResultFormatter {
  formatResult(task, selection, execution, logs) {
    return {
      task: {
        description: task.description,
        domain: task.domain,
        complexity: task.complexity,
        requiredCapabilities: task.requiredCapabilities,
        contextSize: task.contextSize,
        taskType: task.taskType
      },
      execution: {
        modelUsed: execution.modelUsed,
        executionTime: execution.executionTime,
        tokensUsed: execution.tokensUsed,
        confidence: execution.confidence
      },
      selection: {
        selectedModel: selection.selectedModel,
        justification: selection.reasoning,
        alternatives: selection.alternatives
      },
      result: {
        response: execution.response,
        metadata: execution.metadata
      },
      logs
    };
  }
  toJSON(result) {
    return JSON.stringify(result, null, 2);
  }
  toText(result) {
    const parts = [];
    parts.push(`=== Mini-SWE Agent Execution Result ===
`);
    parts.push("TASK:");
    parts.push(`  Type: ${result.task.taskType}`);
    parts.push(`  Domain: ${result.task.domain}`);
    parts.push(`  Complexity: ${result.task.complexity}`);
    parts.push(`  Description: ${result.task.description}`);
    parts.push("");
    parts.push("MODEL SELECTION:");
    parts.push(`  Selected: ${result.selection.selectedModel}`);
    parts.push(`  Justification: ${result.selection.justification}`);
    if (result.selection.alternatives.length > 0) {
      parts.push("  Alternatives:");
      result.selection.alternatives.forEach((alt) => {
        parts.push(`    - ${alt.modelName} (score: ${alt.score.toFixed(1)})`);
      });
    }
    parts.push("");
    parts.push("EXECUTION:");
    parts.push(`  Model Used: ${result.execution.modelUsed}`);
    parts.push(`  Execution Time: ${result.execution.executionTime}ms`);
    parts.push(`  Tokens Used: ${result.execution.tokensUsed}`);
    parts.push(`  Confidence: ${result.execution.confidence}%`);
    parts.push("");
    parts.push("RESPONSE:");
    parts.push(result.result.response);
    parts.push("");
    return parts.join(`
`);
  }
  formatError(task, error, logs) {
    return {
      task: {
        description: task.description,
        domain: task.domain,
        complexity: task.complexity,
        requiredCapabilities: task.requiredCapabilities,
        contextSize: task.contextSize,
        taskType: task.taskType
      },
      execution: {
        modelUsed: "none",
        executionTime: 0,
        tokensUsed: 0,
        confidence: 0
      },
      selection: {
        selectedModel: "none",
        justification: "Task execution failed",
        alternatives: []
      },
      result: {
        response: "",
        metadata: {
          error,
          success: false
        }
      },
      logs
    };
  }
}

// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// src/types/index.ts
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigurationError";
  }
}

class AvailabilityError extends Error {
  constructor(message) {
    super(message);
    this.name = "AvailabilityError";
  }
}

// src/components/TaskParser.ts
class TaskParser {
  parseTask(input) {
    this.validateTask(input);
    const description = input.description.trim();
    const taskType = this.detectTaskType(input.taskType, description);
    const domain = this.detectDomain(description, taskType);
    const complexity = this.detectComplexity(description);
    const requiredCapabilities = this.extractCapabilities(description, taskType, domain);
    const contextSize = this.calculateContextSize(input.context);
    return {
      description,
      domain,
      complexity,
      requiredCapabilities,
      contextSize,
      taskType
    };
  }
  validateTask(input) {
    if (!input.description || input.description.trim().length === 0) {
      throw new ValidationError("Task description cannot be empty or contain only whitespace");
    }
    if (input.description.trim().length < 10) {
      throw new ValidationError("Task description is too short. Please provide more detail (minimum 10 characters)");
    }
  }
  detectTaskType(explicitType, description) {
    if (explicitType) {
      const normalizedType = this.normalizeTaskType(explicitType);
      if (normalizedType)
        return normalizedType;
    }
    const lowerDesc = description.toLowerCase();
    if (this.matchesPatterns(lowerDesc, ["generate", "create", "write code", "implement"])) {
      return "code_generation";
    }
    if (this.matchesPatterns(lowerDesc, ["bug", "fix", "error", "issue", "debug"])) {
      return "bug_fixing";
    }
    if (this.matchesPatterns(lowerDesc, ["review", "analyze code", "check code", "audit"])) {
      return "code_review";
    }
    if (this.matchesPatterns(lowerDesc, ["test", "unit test", "testing", "test case"])) {
      return "test_writing";
    }
    if (this.matchesPatterns(lowerDesc, ["document", "documentation", "readme", "doc"])) {
      return "documentation";
    }
    if (this.matchesPatterns(lowerDesc, ["architecture", "design", "structure", "system"])) {
      return "architecture_analysis";
    }
    return "general";
  }
  normalizeTaskType(type) {
    const typeMap = {
      code_generation: "code_generation",
      codegen: "code_generation",
      generate: "code_generation",
      bug_fixing: "bug_fixing",
      bugfix: "bug_fixing",
      fix: "bug_fixing",
      code_review: "code_review",
      review: "code_review",
      test_writing: "test_writing",
      test: "test_writing",
      testing: "test_writing",
      documentation: "documentation",
      docs: "documentation",
      architecture_analysis: "architecture_analysis",
      architecture: "architecture_analysis",
      design: "architecture_analysis"
    };
    return typeMap[type.toLowerCase()] || null;
  }
  detectDomain(description, taskType) {
    const lowerDesc = description.toLowerCase();
    if (["code_generation", "bug_fixing", "code_review", "test_writing"].includes(taskType)) {
      return "code";
    }
    if (this.matchesPatterns(lowerDesc, ["math", "calculate", "formula", "equation", "proof"])) {
      return "math";
    }
    if (this.matchesPatterns(lowerDesc, ["reason", "logic", "deduce", "infer", "conclude"])) {
      return "reasoning";
    }
    if (this.matchesPatterns(lowerDesc, ["image", "video", "audio", "visual", "diagram"])) {
      return "multimodal";
    }
    if (this.matchesPatterns(lowerDesc, ["code", "function", "class", "api", "program", "script"])) {
      return "code";
    }
    return "general";
  }
  detectComplexity(description) {
    const lowerDesc = description.toLowerCase();
    const length = description.length;
    if (this.matchesPatterns(lowerDesc, [
      "complex",
      "advanced",
      "sophisticated",
      "distributed",
      "scalable",
      "high-performance",
      "optimize",
      "refactor entire",
      "architectural"
    ])) {
      return "expert";
    }
    if (this.matchesPatterns(lowerDesc, [
      "multiple",
      "integrate",
      "system",
      "framework",
      "algorithm",
      "design pattern"
    ]) || length > 500) {
      return "complex";
    }
    if (this.matchesPatterns(lowerDesc, [
      "implement",
      "create",
      "build",
      "develop",
      "function",
      "class"
    ]) || length > 200) {
      return "moderate";
    }
    return "simple";
  }
  extractCapabilities(description, taskType, domain) {
    const capabilities = new Set;
    const lowerDesc = description.toLowerCase();
    if (domain === "code") {
      capabilities.add("code_generation");
    }
    if (domain === "math") {
      capabilities.add("math");
    }
    if (domain === "reasoning") {
      capabilities.add("reasoning");
    }
    if (domain === "multimodal") {
      capabilities.add("multimodal");
    }
    if (taskType === "test_writing") {
      capabilities.add("testing");
    }
    if (taskType === "bug_fixing") {
      capabilities.add("debugging");
    }
    if (this.matchesPatterns(lowerDesc, ["tool", "command", "terminal", "cli"])) {
      capabilities.add("tool_use");
    }
    if (this.matchesPatterns(lowerDesc, ["analyze", "review", "audit"])) {
      capabilities.add("code_analysis");
    }
    if (this.matchesPatterns(lowerDesc, ["explain", "document", "describe"])) {
      capabilities.add("explanation");
    }
    capabilities.add("reasoning");
    return Array.from(capabilities);
  }
  calculateContextSize(context) {
    if (!context)
      return 0;
    return context.length;
  }
  matchesPatterns(text, patterns) {
    return patterns.some((pattern) => text.includes(pattern));
  }
}

// src/components/ModelRegistry.ts
import * as fs from "fs/promises";
class ModelRegistry {
  profiles = new Map;
  async loadProfiles(configPath) {
    try {
      const fileContent = await fs.readFile(configPath, "utf-8");
      const config = this.parseYAML(fileContent);
      if (!config.models || typeof config.models !== "object") {
        throw new ConfigurationError('Invalid configuration format: missing or invalid "models" field');
      }
      for (const [modelName, profileData] of Object.entries(config.models)) {
        try {
          const profile = this.validateAndCreateProfile(modelName, profileData);
          this.profiles.set(modelName, profile);
        } catch (error) {
          console.warn(`Skipping invalid model profile "${modelName}": ${error.message}`);
        }
      }
      if (this.profiles.size === 0) {
        throw new ConfigurationError("No valid model profiles found in configuration");
      }
      console.error(`Loaded ${this.profiles.size} model profiles from configuration`);
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }
      throw new ConfigurationError(`Failed to load configuration from ${configPath}: ${error.message}`);
    }
  }
  async verifyAvailability(availableModels) {
    for (const [modelName, profile] of this.profiles.entries()) {
      profile.available = availableModels.includes(modelName);
    }
    const availableCount = Array.from(this.profiles.values()).filter((p) => p.available).length;
    console.error(`${availableCount}/${this.profiles.size} models available on Ollama server`);
  }
  getProfile(modelName) {
    return this.profiles.get(modelName) || null;
  }
  getAllProfiles() {
    return Array.from(this.profiles.values());
  }
  getAvailableProfiles() {
    return Array.from(this.profiles.values()).filter((p) => p.available);
  }
  parseYAML(content) {
    try {
      const lines = content.split(`
`);
      const config = { models: {} };
      let currentModel = null;
      let currentField = null;
      let indentLevel = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#"))
          continue;
        const indent = line.search(/\S/);
        if (indent === 0 && trimmed === "models:") {
          continue;
        }
        if (indent === 2 && trimmed.endsWith(":")) {
          currentModel = trimmed.slice(0, -1);
          config.models[currentModel] = {};
          continue;
        }
        if (currentModel && indent === 4) {
          if (trimmed.startsWith("-")) {
            const value = trimmed.slice(1).trim();
            if (currentField) {
              if (!Array.isArray(config.models[currentModel][currentField])) {
                config.models[currentModel][currentField] = [];
              }
              config.models[currentModel][currentField].push(value);
            }
          } else if (trimmed.includes(":")) {
            const [key, ...valueParts] = trimmed.split(":");
            const value = valueParts.join(":").trim();
            currentField = key.trim();
            if (value) {
              config.models[currentModel][currentField] = this.parseValue(value);
            } else {
              config.models[currentModel][currentField] = [];
            }
          }
        } else if (currentModel && indent === 6 && trimmed.startsWith("-")) {
          const value = trimmed.slice(1).trim();
          if (currentField && Array.isArray(config.models[currentModel][currentField])) {
            config.models[currentModel][currentField].push(value);
          }
        }
      }
      return config;
    } catch (error) {
      throw new ConfigurationError(`Failed to parse YAML: ${error.message}`);
    }
  }
  parseValue(value) {
    if (value === "true")
      return true;
    if (value === "false")
      return false;
    if (value === "null")
      return null;
    if (/^-?\d+$/.test(value))
      return parseInt(value, 10);
    if (/^-?\d+\.\d+$/.test(value))
      return parseFloat(value);
    return value;
  }
  validateAndCreateProfile(modelName, data) {
    const requiredFields = [
      "provider",
      "domains",
      "maxComplexity",
      "capabilities",
      "contextWindow",
      "estimatedLatency",
      "costPerToken",
      "strengths",
      "weaknesses"
    ];
    for (const field of requiredFields) {
      if (!(field in data)) {
        throw new ConfigurationError(`Missing required field: ${field}`);
      }
    }
    if (!Array.isArray(data.domains) || data.domains.length === 0) {
      throw new ConfigurationError("domains must be a non-empty array");
    }
    if (!Array.isArray(data.capabilities) || data.capabilities.length === 0) {
      throw new ConfigurationError("capabilities must be a non-empty array");
    }
    if (typeof data.contextWindow !== "number" || data.contextWindow <= 0) {
      throw new ConfigurationError("contextWindow must be a positive number");
    }
    if (typeof data.estimatedLatency !== "number" || data.estimatedLatency < 0) {
      throw new ConfigurationError("estimatedLatency must be a non-negative number");
    }
    if (typeof data.costPerToken !== "number" || data.costPerToken < 0) {
      throw new ConfigurationError("costPerToken must be a non-negative number");
    }
    const validComplexities = ["simple", "moderate", "complex", "expert"];
    if (!validComplexities.includes(data.maxComplexity)) {
      throw new ConfigurationError(`Invalid maxComplexity: ${data.maxComplexity}`);
    }
    return {
      name: modelName,
      provider: data.provider,
      domains: data.domains,
      maxComplexity: data.maxComplexity,
      capabilities: data.capabilities,
      contextWindow: data.contextWindow,
      estimatedLatency: data.estimatedLatency,
      costPerToken: data.costPerToken,
      strengths: data.strengths || [],
      weaknesses: data.weaknesses || [],
      available: false
    };
  }
}

// src/components/ModelSelector.ts
class ModelSelector {
  registry;
  constructor(registry) {
    this.registry = registry;
  }
  selectModel(task) {
    const availableProfiles = this.registry.getAvailableProfiles();
    if (availableProfiles.length === 0) {
      throw new AvailabilityError("No models available. Please ensure Ollama Remote MCP is running and models are configured.");
    }
    const scores = availableProfiles.map((profile) => this.scoreModel(task, profile));
    scores.sort((a, b) => {
      if (Math.abs(a.score - b.score) < 0.01) {
        return a.latencyScore - b.latencyScore;
      }
      return b.score - a.score;
    });
    const selectedScore = scores[0];
    const alternatives = scores.slice(1, 4);
    const reasoning = this.generateReasoning(task, selectedScore, alternatives);
    return {
      selectedModel: selectedScore.modelName,
      score: selectedScore,
      alternatives,
      reasoning
    };
  }
  scoreModel(task, profile) {
    const domainMatch = this.calculateDomainMatch(task, profile);
    const complexityMatch = this.calculateComplexityMatch(task, profile);
    const capabilityMatch = this.calculateCapabilityMatch(task, profile);
    const contextMatch = this.calculateContextMatch(task, profile);
    const latencyScore = this.calculateLatencyScore(profile);
    const totalScore = domainMatch * 0.3 + complexityMatch * 0.25 + capabilityMatch * 0.25 + contextMatch * 0.1 + latencyScore * 0.1;
    const justification = this.generateJustification(profile, domainMatch, complexityMatch, capabilityMatch, contextMatch, latencyScore);
    return {
      modelName: profile.name,
      score: Math.round(totalScore * 100) / 100,
      domainMatch: Math.round(domainMatch * 100) / 100,
      complexityMatch: Math.round(complexityMatch * 100) / 100,
      capabilityMatch: Math.round(capabilityMatch * 100) / 100,
      contextMatch: Math.round(contextMatch * 100) / 100,
      latencyScore: Math.round(latencyScore * 100) / 100,
      justification
    };
  }
  calculateDomainMatch(task, profile) {
    if (profile.domains.includes(task.domain)) {
      return 100;
    }
    if (task.domain === "general" || profile.domains.includes("general")) {
      return 50;
    }
    if (task.domain === "reasoning" && profile.domains.includes("code")) {
      return 40;
    }
    return 0;
  }
  calculateComplexityMatch(task, profile) {
    const complexityLevels = ["simple", "moderate", "complex", "expert"];
    const taskLevel = complexityLevels.indexOf(task.complexity);
    const modelLevel = complexityLevels.indexOf(profile.maxComplexity);
    if (modelLevel >= taskLevel) {
      return 100;
    } else {
      const gap = taskLevel - modelLevel;
      return Math.max(0, 100 - gap * 30);
    }
  }
  calculateCapabilityMatch(task, profile) {
    if (task.requiredCapabilities.length === 0) {
      return 100;
    }
    const matchedCapabilities = task.requiredCapabilities.filter((cap) => profile.capabilities.includes(cap));
    const matchPercentage = matchedCapabilities.length / task.requiredCapabilities.length * 100;
    return matchPercentage;
  }
  calculateContextMatch(task, profile) {
    const estimatedTaskSize = task.description.length + task.contextSize;
    if (estimatedTaskSize <= profile.contextWindow * 0.5) {
      return 100;
    } else if (estimatedTaskSize <= profile.contextWindow * 0.8) {
      return 80;
    } else if (estimatedTaskSize <= profile.contextWindow) {
      return 60;
    } else {
      return 0;
    }
  }
  calculateLatencyScore(profile) {
    const maxLatency = 1e4;
    const minLatency = 1000;
    const normalizedLatency = Math.min(Math.max(profile.estimatedLatency, minLatency), maxLatency);
    const score = 100 - (normalizedLatency - minLatency) / (maxLatency - minLatency) * 100;
    return Math.max(0, Math.min(100, score));
  }
  generateJustification(profile, domainMatch, complexityMatch, capabilityMatch, contextMatch, latencyScore) {
    const parts = [];
    if (domainMatch >= 100) {
      parts.push(`Perfect domain match`);
    } else if (domainMatch >= 50) {
      parts.push(`Partial domain match`);
    } else {
      parts.push(`Limited domain match`);
    }
    if (complexityMatch >= 100) {
      parts.push(`can handle required complexity`);
    } else if (complexityMatch >= 70) {
      parts.push(`mostly suitable for complexity level`);
    } else {
      parts.push(`may struggle with task complexity`);
    }
    if (capabilityMatch >= 100) {
      parts.push(`has all required capabilities`);
    } else if (capabilityMatch >= 70) {
      parts.push(`has most required capabilities`);
    } else {
      parts.push(`missing some capabilities`);
    }
    return parts.join(", ");
  }
  generateReasoning(task, selectedScore, alternatives) {
    const parts = [];
    parts.push(`Selected ${selectedScore.modelName} with score ${selectedScore.score.toFixed(1)}/100`);
    parts.push(`Task characteristics: ${task.domain} domain, ${task.complexity} complexity, ` + `requires [${task.requiredCapabilities.join(", ")}]`);
    parts.push(`Scoring breakdown: ${selectedScore.justification}`);
    if (alternatives.length > 0) {
      const altList = alternatives.map((alt) => `${alt.modelName} (${alt.score.toFixed(1)})`).join(", ");
      parts.push(`Alternative models considered: ${altList}`);
    }
    return parts.join(". ") + ".";
  }
}

// src/components/SystemPromptGenerator.ts
class SystemPromptGenerator {
  generateSystemPrompt(config) {
    const basePrompt = this.getBasePrompt();
    const taskSpecific = this.getTaskSpecificPrompt(config.taskType);
    const domainGuidance = this.getDomainGuidance(config.domain);
    const contextInclusion = config.context ? this.formatContext(config.context) : "";
    return [basePrompt, taskSpecific, domainGuidance, contextInclusion].filter(Boolean).join(`

`);
  }
  getBasePrompt() {
    return `You are an expert software engineering assistant. Your role is to provide accurate, well-reasoned, and actionable solutions to software engineering tasks. Follow best practices, write clean code, and explain your reasoning when appropriate.`;
  }
  getTaskSpecificPrompt(taskType) {
    const prompts = {
      code_generation: this.getCodeGenerationPrompt(),
      bug_fixing: this.getBugFixingPrompt(),
      code_review: this.getCodeReviewPrompt(),
      test_writing: this.getTestWritingPrompt(),
      documentation: this.getDocumentationPrompt(),
      architecture_analysis: this.getArchitectureAnalysisPrompt(),
      general: this.getGeneralPrompt()
    };
    return prompts[taskType] || prompts.general;
  }
  getCodeGenerationPrompt() {
    return `TASK: Code Generation

Guidelines:
- Write clean, maintainable, and well-documented code
- Follow language-specific best practices and conventions
- Include error handling and edge case considerations
- Add inline comments for complex logic
- Ensure code is production-ready and tested
- Consider performance and scalability
- Use appropriate design patterns when applicable`;
  }
  getBugFixingPrompt() {
    return `TASK: Bug Fixing

Guidelines:
- Identify the root cause of the issue, not just symptoms
- Provide a clear explanation of what went wrong
- Suggest a minimal, targeted fix that doesn't introduce new issues
- Consider edge cases that might trigger similar bugs
- Recommend tests to prevent regression
- Explain why the fix works and what it changes`;
  }
  getCodeReviewPrompt() {
    return `TASK: Code Review

Guidelines:
- Evaluate code for correctness, security, and performance
- Check for adherence to best practices and conventions
- Identify potential bugs, edge cases, and error conditions
- Assess maintainability, readability, and documentation
- Suggest specific improvements with examples
- Highlight security vulnerabilities if present
- Consider scalability and architectural implications`;
  }
  getTestWritingPrompt() {
    return `TASK: Test Writing

Guidelines:
- Write comprehensive test cases covering happy paths and edge cases
- Include tests for error conditions and boundary values
- Ensure tests are clear, maintainable, and well-named
- Use appropriate test patterns (AAA: Arrange, Act, Assert)
- Consider integration tests for component interactions
- Aim for meaningful coverage, not just high percentage
- Make tests independent and repeatable`;
  }
  getDocumentationPrompt() {
    return `TASK: Documentation

Guidelines:
- Write clear, concise, and accurate documentation
- Include practical examples and use cases
- Explain both "what" and "why" for key decisions
- Structure content logically with headers and sections
- Use appropriate formatting (markdown, code blocks, etc.)
- Keep audience in mind (end users vs developers)
- Include setup instructions, prerequisites, and troubleshooting`;
  }
  getArchitectureAnalysisPrompt() {
    return `TASK: Architecture Analysis

Guidelines:
- Evaluate system design for scalability, maintainability, and performance
- Identify architectural patterns and their appropriateness
- Assess component coupling and cohesion
- Consider security, reliability, and operational aspects
- Analyze trade-offs between different approaches
- Suggest improvements with clear rationale
- Consider long-term evolution and technical debt`;
  }
  getGeneralPrompt() {
    return `TASK: General Software Engineering

Guidelines:
- Provide accurate and well-reasoned solutions
- Consider best practices and industry standards
- Explain your reasoning clearly
- Address potential edge cases and limitations
- Suggest alternatives when appropriate`;
  }
  getDomainGuidance(domain) {
    const guidance = {
      code: "Focus on code quality, correctness, and maintainability. Use appropriate data structures and algorithms.",
      math: "Ensure mathematical accuracy. Show your work and explain formulas. Verify calculations.",
      reasoning: "Use clear logical steps. Make assumptions explicit. Consider alternative perspectives.",
      multimodal: "Consider all provided inputs (text, images, etc.). Explain visual elements clearly."
    };
    return guidance[domain] || "";
  }
  formatContext(context) {
    return `CONTEXT:
${context}

Use the above context to inform your response.`;
  }
}

// src/components/TaskExecutor.ts
class TaskExecutor {
  client;
  defaultTimeout;
  constructor(client, timeout = 60000) {
    this.client = client;
    this.defaultTimeout = timeout;
  }
  async executeTask(request, timeout) {
    const startTime = Date.now();
    const actualTimeout = timeout || this.defaultTimeout;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Execution timeout after ${actualTimeout}ms`));
        }, actualTimeout);
      });
      const executionPromise = this.client.chat(request.modelName, this.formatMessage(request), request.systemPrompt, request.temperature || 0.7);
      const result = await Promise.race([executionPromise, timeoutPromise]);
      const executionTime = Date.now() - startTime;
      return {
        success: true,
        modelUsed: request.modelName,
        response: result.content,
        executionTime,
        tokensUsed: result.tokensUsed || this.estimateTokens(result.content),
        confidence: this.calculateConfidence(result.content, executionTime),
        metadata: {
          taskType: request.task.taskType,
          domain: request.task.domain,
          complexity: request.task.complexity,
          temperature: request.temperature || 0.7
        }
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        success: false,
        modelUsed: request.modelName,
        response: "",
        executionTime,
        tokensUsed: 0,
        confidence: 0,
        metadata: {
          error: error.message,
          taskType: request.task.taskType,
          domain: request.task.domain,
          complexity: request.task.complexity
        }
      };
    }
  }
  async executeWithFallback(request, fallbackModels, timeout) {
    const errors = [];
    const modelsToTry = [request.modelName, ...fallbackModels];
    for (const model of modelsToTry) {
      try {
        const modifiedRequest = { ...request, modelName: model };
        const result = await this.executeTask(modifiedRequest, timeout);
        if (result.success) {
          return result;
        } else {
          errors.push({
            modelAttempted: model,
            error: result.metadata?.error || "Execution failed",
            timestamp: Date.now()
          });
        }
      } catch (error) {
        errors.push({
          modelAttempted: model,
          error: error.message,
          timestamp: Date.now()
        });
      }
    }
    return errors;
  }
  formatMessage(request) {
    const parts = [];
    parts.push(request.task.description);
    if (request.task.contextSize > 0) {}
    return parts.join(`

`);
  }
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }
  calculateConfidence(response, executionTime) {
    let confidence = 50;
    if (response.length > 1000)
      confidence += 10;
    if (response.length > 2000)
      confidence += 10;
    if (executionTime > 5000 && executionTime < 30000)
      confidence += 10;
    if (executionTime < 1000)
      confidence -= 10;
    if (response.includes("```"))
      confidence += 10;
    if (response.toLowerCase().includes("because") || response.toLowerCase().includes("reason")) {
      confidence += 5;
    }
    return Math.max(0, Math.min(100, confidence));
  }
}
// src/components/ExecutionLogger.ts
class ExecutionLogger {
  logs = [];
  logLevel;
  constructor(logLevel = "INFO") {
    this.logLevel = logLevel;
  }
  log(level, step, details = {}) {
    if (!this.shouldLog(level)) {
      return;
    }
    const log = {
      timestamp: Date.now(),
      level,
      step,
      details
    };
    this.logs.push(log);
    if (true) {
      this.outputToConsole(log);
    }
  }
  debug(step, details = {}) {
    this.log("DEBUG", step, details);
  }
  info(step, details = {}) {
    this.log("INFO", step, details);
  }
  warn(step, details = {}) {
    this.log("WARN", step, details);
  }
  error(step, details = {}) {
    this.log("ERROR", step, details);
  }
  getLogs() {
    return [...this.logs];
  }
  getLogsByLevel(level) {
    return this.logs.filter((log) => log.level === level);
  }
  clear() {
    this.logs = [];
  }
  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }
  setLogLevel(level) {
    this.logLevel = level;
  }
  shouldLog(level) {
    const levels = ["DEBUG", "INFO", "WARN", "ERROR"];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }
  outputToConsole(log) {
    const timestamp = new Date(log.timestamp).toISOString();
    const prefix = `[${timestamp}] [${log.level}]`;
    const message = `${prefix} ${log.step}`;
    const hasDetails = Object.keys(log.details).length > 0;
    switch (log.level) {
      case "DEBUG":
        console.debug(message, hasDetails ? log.details : "");
        break;
      case "INFO":
        console.log(message, hasDetails ? log.details : "");
        break;
      case "WARN":
        console.warn(message, hasDetails ? log.details : "");
        break;
      case "ERROR":
        console.error(message, hasDetails ? log.details : "");
        break;
    }
  }
}

// src/mini-swe-agent/MiniSWEAgent.ts
class MiniSWEAgent {
  config;
  taskParser;
  modelRegistry;
  modelSelector;
  promptGenerator;
  taskExecutor;
  resultFormatter;
  logger;
  initialized = false;
  constructor(config) {
    this.config = config;
    this.taskParser = new TaskParser;
    this.modelRegistry = new ModelRegistry;
    this.modelSelector = new ModelSelector(this.modelRegistry);
    this.promptGenerator = new SystemPromptGenerator;
    this.taskExecutor = new TaskExecutor(config.ollamaClient, config.timeout);
    this.resultFormatter = new ResultFormatter;
    this.logger = new ExecutionLogger(config.logLevel || "INFO");
  }
  async initialize() {
    if (this.initialized) {
      return;
    }
    this.logger.info("Initializing Mini-SWE Agent", {
      configPath: this.config.configPath
    });
    try {
      await this.modelRegistry.loadProfiles(this.config.configPath);
      this.logger.info("Model profiles loaded successfully");
      const allProfiles = this.modelRegistry.getAllProfiles();
      await this.modelRegistry.verifyAvailability(allProfiles.map((p) => p.name));
      this.initialized = true;
      this.logger.info("Mini-SWE Agent initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize Mini-SWE Agent", {
        error: error.message
      });
      throw error;
    }
  }
  async executeTask(input) {
    if (!this.initialized) {
      await this.initialize();
    }
    this.logger.clear();
    this.logger.info("Starting task execution", { task: input.description });
    try {
      this.logger.debug("Parsing task");
      const parsedTask = this.taskParser.parseTask(input);
      this.logger.info("Task parsed", {
        domain: parsedTask.domain,
        complexity: parsedTask.complexity,
        taskType: parsedTask.taskType
      });
      this.logger.debug("Selecting model");
      const selection = this.modelSelector.selectModel(parsedTask);
      this.logger.info("Model selected", {
        model: selection.selectedModel,
        score: selection.score.score
      });
      this.logger.debug("Generating system prompt");
      const systemPrompt = this.promptGenerator.generateSystemPrompt({
        taskType: parsedTask.taskType,
        modelName: selection.selectedModel,
        domain: parsedTask.domain,
        context: input.context
      });
      const executionRequest = {
        task: parsedTask,
        modelName: selection.selectedModel,
        systemPrompt,
        temperature: 0.7
      };
      this.logger.debug("Executing task", { model: selection.selectedModel });
      const fallbackModels = selection.alternatives.map((alt) => alt.modelName);
      const executionResult = await this.taskExecutor.executeWithFallback(executionRequest, fallbackModels);
      let finalResult;
      if (Array.isArray(executionResult)) {
        const errors = executionResult;
        this.logger.error("All models failed", {
          attemptedModels: errors.map((e) => e.modelAttempted)
        });
        return this.resultFormatter.formatError(parsedTask, `All models failed: ${errors.map((e) => `${e.modelAttempted}: ${e.error}`).join("; ")}`, this.logger.getLogs());
      } else {
        finalResult = executionResult;
        this.logger.info("Task execution completed", {
          modelUsed: finalResult.modelUsed,
          executionTime: finalResult.executionTime,
          confidence: finalResult.confidence
        });
      }
      const formattedResult = this.resultFormatter.formatResult(parsedTask, selection, finalResult, this.logger.getLogs());
      return formattedResult;
    } catch (error) {
      this.logger.error("Task execution failed", { error: error.message });
      const parsedTask = this.taskParser.parseTask(input);
      return this.resultFormatter.formatError(parsedTask, error.message, this.logger.getLogs());
    }
  }
  getLogs() {
    return this.logger.exportLogs();
  }
  getModelRegistry() {
    return this.modelRegistry;
  }
}

// src/mini-swe-agent/OllamaRemoteMCPClient.ts
class OllamaRemoteMCPClient {
  baseUrl;
  apiKey;
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    this.apiKey = apiKey || process.env.OLLAMA_API_KEY || "";
  }
  async listModels() {
    try {
      const url = `${this.baseUrl.replace(/\/$/, "")}/api/tags`;
      const headers = {
        "Content-Type": "application/json"
      };
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }
      const response = await fetch(url, {
        method: "GET",
        headers
      });
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      const models = data.models || [];
      return models.map((model) => model.name);
    } catch (error) {
      console.error("Failed to list Ollama models:", error.message);
      return [];
    }
  }
  async chat(model, message, systemPrompt, temperature) {
    const startTime = Date.now();
    try {
      const url = `${this.baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
      const headers = {
        "Content-Type": "application/json"
      };
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }
      const body = {
        model,
        messages: [
          ...systemPrompt ? [{ role: "system", content: systemPrompt }] : [],
          { role: "user", content: message }
        ],
        stream: false,
        options: {
          temperature: temperature || 0.7
        }
      };
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      const tokensUsed = data.usage?.total_tokens;
      const executionTime = Date.now() - startTime;
      return {
        content,
        tokensUsed,
        executionTime
      };
    } catch (error) {
      throw new Error(`Failed to chat with model ${model}: ${error.message}`);
    }
  }
  async testConnection() {
    try {
      const models = await this.listModels();
      return models.length > 0;
    } catch (error) {
      return false;
    }
  }
}

// src/index.ts
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
var __filename2 = fileURLToPath(import.meta.url);
var __dirname2 = dirname(__filename2);
function formatSize(bytes) {
  if (bytes === 0)
    return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
var OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
var OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || "";
var server = new McpServer({
  name: "remote-ollama-mcp",
  version: "1.0.0"
});
var configPath = process.env.MINI_SWE_CONFIG_PATH || path.join(__dirname2, "../config/models.yaml");
var ollamaClient = new OllamaRemoteMCPClient(OLLAMA_BASE_URL, OLLAMA_API_KEY);
var miniSWEAgent = new MiniSWEAgent({
  configPath,
  ollamaClient,
  logLevel: process.env.MINI_SWE_LOG_LEVEL || "INFO",
  timeout: parseInt(process.env.MINI_SWE_TIMEOUT || "60000")
});
server.tool("list_ollama_models", "列出远程 Ollama 服务器上所有可用的模型", {
  only_remote: z.boolean().optional().default(false).describe("只显示云端模型信息，默认显示所有模型")
}, async ({ only_remote }) => {
  try {
    const url = `${OLLAMA_BASE_URL.replace(/\/$/, "")}/api/tags`;
    const headers = {
      "Content-Type": "application/json"
    };
    if (OLLAMA_API_KEY) {
      headers["Authorization"] = `Bearer ${OLLAMA_API_KEY}`;
    }
    const response = await fetch(url, {
      method: "GET",
      headers
    });
    if (!response.ok) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Ollama API responded with status ${response.status}: ${response.statusText}`
          }
        ],
        isError: true
      };
    }
    const data = await response.json();
    const models = data.models || [];
    if (models.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `当前 Ollama 服务器上没有可用的模型。

您可以通过以下方式获取模型：
1. 本地模型：使用 \`ollama pull <模型名>\` 下载模型
2. 云端模型：配置 Ollama Cloud 账户或代理服务`
          }
        ]
      };
    }
    const modelList = models.map((model) => {
      const name = model.name;
      const size = model.size;
      const modifiedAt = model.modified_at;
      const isRemoteModel = name.includes("cloud") || name.includes("online") || name.includes("api") || name.includes("remote") || name.includes("llama3") && name.includes(":") === false;
      return {
        name,
        size: formatSize(size),
        modifiedAt,
        isRemoteModel
      };
    });
    const filteredModels = only_remote ? modelList.filter((model) => model.isRemoteModel) : modelList;
    const displayModels = filteredModels.length > 0 ? filteredModels : modelList;
    const modelListText = displayModels.map((model, index) => {
      const prefix = model.isRemoteModel ? "☁️ 云端" : "\uD83D\uDCBE 本地";
      return `${index + 1}. **${prefix}** ${model.name}
   - 大小: ${model.size}
   - 更新时间: ${model.modifiedAt}`;
    }).join(`

`);
    const summary = `\uD83E\uDD16 Ollama 模型列表

总共有 ${models.length} 个可用模型${only_remote ? " (仅显示云端模型)" : ""}:

${modelListText}`;
    return {
      content: [
        {
          type: "text",
          text: summary
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `连接失败: ${error.message}。请检查您的 OLLAMA_BASE_URL 和网络连接。`
        }
      ],
      isError: true
    };
  }
});
server.tool("chat_with_remote_ollama", "向远程 Ollama 服务器发送对话请求，支持自定义模型", {
  model: z.string().describe("要使用的模型名称，例如 'llama3', 'deepseek-coder'"),
  message: z.string().describe("发送给模型的提示词或问题"),
  system_prompt: z.string().optional().describe("可选的系统级指令"),
  temperature: z.number().optional().default(0.7).describe("模型温度，0-1之间")
}, async ({ model, message, system_prompt, temperature }) => {
  try {
    const url = `${OLLAMA_BASE_URL.replace(/\/$/, "")}/v1/chat/completions`;
    const headers = {
      "Content-Type": "application/json"
    };
    if (OLLAMA_API_KEY) {
      headers["Authorization"] = `Bearer ${OLLAMA_API_KEY}`;
    }
    const body = {
      model,
      messages: [
        ...system_prompt ? [{ role: "system", content: system_prompt }] : [],
        { role: "user", content: message }
      ],
      stream: false,
      options: {
        temperature
      }
    };
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Ollama API responded with status ${response.status}: ${response.statusText}`
          }
        ],
        isError: true
      };
    }
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "No content returned";
    console.error("[MCP DEBUG] Extracted reply:", reply);
    return {
      content: [
        {
          type: "text",
          text: reply
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Connection Failed: ${error.message}. Please check your OLLAMA_BASE_URL and connectivity.`
        }
      ],
      isError: true
    };
  }
});
server.tool("mini_swe_execute_task", "智能软件工程任务执行工具。自动选择最适合的模型来完成软件工程任务,支持代码生成、bug修复、代码审查、测试编写等任务类型。", {
  description: z.string().describe("任务描述,至少10个字符,详细说明要完成的任务"),
  context: z.string().optional().describe("可选的上下文信息,如代码片段、错误信息等"),
  task_type: z.string().optional().describe("可选的任务类型:code_generation, bug_fixing, code_review, test_writing, documentation, architecture_analysis")
}, async ({ description, context, task_type }) => {
  try {
    const result = await miniSWEAgent.executeTask({
      description,
      context,
      taskType: task_type
    });
    const formatter = new (await Promise.resolve().then(() => exports_ResultFormatter)).ResultFormatter;
    const textResult = formatter.toText(result);
    return {
      content: [
        {
          type: "text",
          text: textResult
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Mini-SWE Agent execution failed: ${error.message}`
        }
      ],
      isError: true
    };
  }
});
async function main() {
  const transport = new StdioServerTransport;
  await server.connect(transport);
  console.error("Remote Ollama MCP Server running on stdio");
}
main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
