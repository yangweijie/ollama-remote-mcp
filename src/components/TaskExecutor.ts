import {
  ExecutionRequest,
  ExecutionResult,
  ExecutionError as ExecutionErrorType,
} from '../types/index.js';

/**
 * Interface for Ollama Remote MCP client
 * This will be implemented by integrating with the existing MCP server
 */
export interface OllamaClient {
  chat(model: string, message: string, systemPrompt?: string, temperature?: number): Promise<{
    content: string;
    tokensUsed?: number;
    executionTime?: number;
  }>;
}

export class TaskExecutor {
  private client: OllamaClient;
  private defaultTimeout: number;

  constructor(client: OllamaClient, timeout: number = 60000) {
    this.client = client;
    this.defaultTimeout = timeout;
  }

  /**
   * Execute a task using the specified model
   */
  async executeTask(
    request: ExecutionRequest,
    timeout?: number
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const actualTimeout = timeout || this.defaultTimeout;

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Execution timeout after ${actualTimeout}ms`));
        }, actualTimeout);
      });

      // Execute the task
      const executionPromise = this.client.chat(
        request.modelName,
        this.formatMessage(request),
        request.systemPrompt,
        request.temperature || 0.7
      );

      // Race between execution and timeout
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
          temperature: request.temperature || 0.7,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      // Return as failed execution result
      return {
        success: false,
        modelUsed: request.modelName,
        response: '',
        executionTime,
        tokensUsed: 0,
        confidence: 0,
        metadata: {
          error: error.message,
          taskType: request.task.taskType,
          domain: request.task.domain,
          complexity: request.task.complexity,
        },
      };
    }
  }

  /**
   * Execute task with fallback models
   */
  async executeWithFallback(
    request: ExecutionRequest,
    fallbackModels: string[],
    timeout?: number
  ): Promise<ExecutionResult | ExecutionErrorType[]> {
    const errors: ExecutionErrorType[] = [];
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
            error: result.metadata?.error || 'Execution failed',
            timestamp: Date.now(),
          });
        }
      } catch (error: any) {
        errors.push({
          modelAttempted: model,
          error: error.message,
          timestamp: Date.now(),
        });
      }
    }

    // All models failed
    return errors;
  }

  /**
   * Format task message for model
   */
  private formatMessage(request: ExecutionRequest): string {
    const parts: string[] = [];

    parts.push(request.task.description);

    if (request.task.contextSize > 0) {
      // Context is included in the system prompt
      // No need to duplicate it here
    }

    return parts.join('\n\n');
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate confidence score based on response characteristics
   */
  private calculateConfidence(response: string, executionTime: number): number {
    let confidence = 50; // Base confidence

    // Adjust based on response length (longer responses often more detailed)
    if (response.length > 1000) confidence += 10;
    if (response.length > 2000) confidence += 10;

    // Adjust based on execution time (very quick might be incomplete)
    if (executionTime > 5000 && executionTime < 30000) confidence += 10;
    if (executionTime < 1000) confidence -= 10;

    // Check for code blocks (often indicates structured output)
    if (response.includes('```')) confidence += 10;

    // Check for explanations
    if (response.toLowerCase().includes('because') || response.toLowerCase().includes('reason')) {
      confidence += 5;
    }

    return Math.max(0, Math.min(100, confidence));
  }
}
