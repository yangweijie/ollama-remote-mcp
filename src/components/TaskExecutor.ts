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

    console.error(`[TaskExecutor] STEP 1: Starting task execution for model: ${request.modelName}`);
    console.error(`[TaskExecutor] STEP 2: Task type: ${request.task.taskType}, Domain: ${request.task.domain}`);
    console.error(`[TaskExecutor] STEP 3: Timeout set to: ${actualTimeout}ms`);

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          console.error(`[TaskExecutor] TIMEOUT: Execution exceeded ${actualTimeout}ms`);
          reject(new Error(`Execution timeout after ${actualTimeout}ms`));
        }, actualTimeout);
      });

      // Format message
      const formattedMessage = this.formatMessage(request);
      console.error(`[TaskExecutor] STEP 4: Message formatted, length: ${formattedMessage.length} chars`);
      console.error(`[TaskExecutor] STEP 5: System prompt length: ${request.systemPrompt?.length || 0} chars`);

      // Execute the task
      console.error(`[TaskExecutor] STEP 6: Calling Ollama client.chat() with model: ${request.modelName}`);
      const executionPromise = this.client.chat(
        request.modelName,
        formattedMessage,
        request.systemPrompt,
        request.temperature || 0.7
      );

      // Race between execution and timeout
      console.error(`[TaskExecutor] STEP 7: Waiting for response (timeout: ${actualTimeout}ms)...`);
      const result = await Promise.race([executionPromise, timeoutPromise]);

      const executionTime = Date.now() - startTime;
      console.error(`[TaskExecutor] STEP 8: Response received in ${executionTime}ms`);
      console.error(`[TaskExecutor] STEP 9: Response length: ${result.content.length} chars`);
      console.error(`[TaskExecutor] STEP 10: Tokens used: ${result.tokensUsed || 'unknown'}`);

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
      console.error(`[TaskExecutor] ERROR: Task execution failed after ${executionTime}ms`);
      console.error(`[TaskExecutor] ERROR MESSAGE: ${error.message}`);
      console.error(`[TaskExecutor] ERROR STACK: ${error.stack}`);

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

    console.error(`[TaskExecutor.executeWithFallback] Starting fallback execution`);
    console.error(`[TaskExecutor.executeWithFallback] Primary model: ${request.modelName}`);
    console.error(`[TaskExecutor.executeWithFallback] Fallback models: ${fallbackModels.join(', ')}`);
    console.error(`[TaskExecutor.executeWithFallback] Total models to try: ${modelsToTry.length}`);

    for (let i = 0; i < modelsToTry.length; i++) {
      const model = modelsToTry[i];
      console.error(`[TaskExecutor.executeWithFallback] Attempt ${i + 1}/${modelsToTry.length}: Trying model "${model}"`);

      try {
        const modifiedRequest = { ...request, modelName: model };
        const result = await this.executeTask(modifiedRequest, timeout);

        if (result.success) {
          console.error(`[TaskExecutor.executeWithFallback] SUCCESS: Model "${model}" succeeded`);
          return result;
        } else {
          const errorMsg = result.metadata?.error || 'Execution failed';
          console.error(`[TaskExecutor.executeWithFallback] FAILED: Model "${model}" failed with error: ${errorMsg}`);
          errors.push({
            modelAttempted: model,
            error: errorMsg,
            timestamp: Date.now(),
          });
        }
      } catch (error: any) {
        console.error(`[TaskExecutor.executeWithFallback] EXCEPTION: Model "${model}" threw exception: ${error.message}`);
        errors.push({
          modelAttempted: model,
          error: error.message,
          timestamp: Date.now(),
        });
      }
    }

    // All models failed
    console.error(`[TaskExecutor.executeWithFallback] ALL MODELS FAILED. Total errors: ${errors.length}`);
    errors.forEach((err, idx) => {
      console.error(`[TaskExecutor.executeWithFallback] Error ${idx + 1}: Model="${err.modelAttempted}", Error="${err.error}"`);
    });
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
