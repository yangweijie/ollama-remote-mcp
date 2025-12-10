import { TaskParser } from '../components/TaskParser.js';
import { ModelRegistry } from '../components/ModelRegistry.js';
import { ModelSelector } from '../components/ModelSelector.js';
import { SystemPromptGenerator } from '../components/SystemPromptGenerator.js';
import { TaskExecutor, OllamaClient } from '../components/TaskExecutor.js';
import { ResultFormatter } from '../components/ResultFormatter.js';
import { ExecutionLogger } from '../components/ExecutionLogger.js';
import {
  TaskParserInput,
  FormattedResult,
  LogLevel,
  ExecutionRequest,
  ExecutionResult,
  ExecutionError as ExecutionErrorType,
} from '../types/index.js';

export interface MiniSWEAgentConfig {
  configPath: string;
  ollamaClient: OllamaClient;
  logLevel?: LogLevel;
  timeout?: number;
}

export class MiniSWEAgent {
  private taskParser: TaskParser;
  private modelRegistry: ModelRegistry;
  private modelSelector: ModelSelector;
  private promptGenerator: SystemPromptGenerator;
  private taskExecutor: TaskExecutor;
  private resultFormatter: ResultFormatter;
  private logger: ExecutionLogger;
  private initialized: boolean = false;

  constructor(private config: MiniSWEAgentConfig) {
    this.taskParser = new TaskParser();
    this.modelRegistry = new ModelRegistry();
    this.modelSelector = new ModelSelector(this.modelRegistry);
    this.promptGenerator = new SystemPromptGenerator();
    this.taskExecutor = new TaskExecutor(config.ollamaClient, config.timeout);
    this.resultFormatter = new ResultFormatter();
    this.logger = new ExecutionLogger(config.logLevel || 'INFO');
  }

  /**
   * Initialize the agent (load configuration, verify models)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger.info('Initializing Mini-SWE Agent', {
      configPath: this.config.configPath,
    });

    try {
      // Load model profiles
      await this.modelRegistry.loadProfiles(this.config.configPath);
      this.logger.info('Model profiles loaded successfully');

      // Verify model availability
      // This would need to be implemented with actual Ollama API call
      // For now, we'll mark all models as available
      const allProfiles = this.modelRegistry.getAllProfiles();
      await this.modelRegistry.verifyAvailability(
        allProfiles.map(p => p.name)
      );

      this.initialized = true;
      this.logger.info('Mini-SWE Agent initialized successfully');
    } catch (error: any) {
      this.logger.error('Failed to initialize Mini-SWE Agent', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Execute a task
   */
  async executeTask(input: TaskParserInput): Promise<FormattedResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    this.logger.clear(); // Clear previous logs
    this.logger.info('Starting task execution', { task: input.description });

    try {
      // 1. Parse task
      this.logger.debug('Parsing task');
      const parsedTask = this.taskParser.parseTask(input);
      this.logger.info('Task parsed', {
        domain: parsedTask.domain,
        complexity: parsedTask.complexity,
        taskType: parsedTask.taskType,
      });

      // 2. Select model
      this.logger.debug('Selecting model');
      const selection = this.modelSelector.selectModel(parsedTask);
      this.logger.info('Model selected', {
        model: selection.selectedModel,
        score: selection.score.score,
      });

      // 3. Generate system prompt
      this.logger.debug('Generating system prompt');
      const systemPrompt = this.promptGenerator.generateSystemPrompt({
        taskType: parsedTask.taskType,
        modelName: selection.selectedModel,
        domain: parsedTask.domain,
        context: input.context,
      });

      // 4. Create execution request
      const executionRequest: ExecutionRequest = {
        task: parsedTask,
        modelName: selection.selectedModel,
        systemPrompt,
        temperature: 0.7,
      };

      // 5. Execute task with fallback
      this.logger.debug('Executing task', { model: selection.selectedModel });
      const fallbackModels = selection.alternatives.map(alt => alt.modelName);
      const executionResult = await this.taskExecutor.executeWithFallback(
        executionRequest,
        fallbackModels
      );

      // 6. Check if execution succeeded or failed
      let finalResult: ExecutionResult;

      if (Array.isArray(executionResult)) {
        // All models failed
        const errors = executionResult as ExecutionErrorType[];
        this.logger.error('All models failed', {
          attemptedModels: errors.map(e => e.modelAttempted),
        });

        return this.resultFormatter.formatError(
          parsedTask,
          `All models failed: ${errors.map(e => `${e.modelAttempted}: ${e.error}`).join('; ')}`,
          this.logger.getLogs()
        );
      } else {
        // Execution succeeded
        finalResult = executionResult as ExecutionResult;
        this.logger.info('Task execution completed', {
          modelUsed: finalResult.modelUsed,
          executionTime: finalResult.executionTime,
          confidence: finalResult.confidence,
        });
      }

      // 7. Format and return result
      const formattedResult = this.resultFormatter.formatResult(
        parsedTask,
        selection,
        finalResult,
        this.logger.getLogs()
      );

      return formattedResult;
    } catch (error: any) {
      this.logger.error('Task execution failed', { error: error.message });

      // Return error result
      const parsedTask = this.taskParser.parseTask(input);
      return this.resultFormatter.formatError(
        parsedTask,
        error.message,
        this.logger.getLogs()
      );
    }
  }

  /**
   * Get execution logs
   */
  getLogs(): string {
    return this.logger.exportLogs();
  }

  /**
   * Get model registry
   */
  getModelRegistry(): ModelRegistry {
    return this.modelRegistry;
  }
}
