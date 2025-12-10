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
      console.error('[MiniSWEAgent] Not initialized, initializing now...');
      await this.initialize();
    }

    this.logger.clear(); // Clear previous logs
    console.error('[MiniSWEAgent] ========== TASK EXECUTION START ==========');
    console.error(`[MiniSWEAgent] Task description: ${input.description}`);
    console.error(`[MiniSWEAgent] Task context: ${input.context ? input.context.substring(0, 100) + '...' : 'none'}`);
    console.error(`[MiniSWEAgent] Task type: ${input.taskType || 'auto-detect'}`);
    this.logger.info('Starting task execution', { task: input.description });

    try {
      // 1. Parse task
      console.error('[MiniSWEAgent] STEP 1: Parsing task...');
      this.logger.debug('Parsing task');
      const parsedTask = this.taskParser.parseTask(input);
      console.error(`[MiniSWEAgent] STEP 1 RESULT: domain=${parsedTask.domain}, complexity=${parsedTask.complexity}, taskType=${parsedTask.taskType}`);
      this.logger.info('Task parsed', {
        domain: parsedTask.domain,
        complexity: parsedTask.complexity,
        taskType: parsedTask.taskType,
      });

      // 2. Select model
      console.error('[MiniSWEAgent] STEP 2: Selecting best model...');
      this.logger.debug('Selecting model');
      const selection = this.modelSelector.selectModel(parsedTask);
      console.error(`[MiniSWEAgent] STEP 2 RESULT: selectedModel=${selection.selectedModel}, score=${selection.score.score}`);
      console.error(`[MiniSWEAgent] STEP 2 ALTERNATIVES: ${selection.alternatives.map(a => `${a.modelName}(${a.score})`).join(', ')}`);
      this.logger.info('Model selected', {
        model: selection.selectedModel,
        score: selection.score.score,
      });

      // 3. Generate system prompt
      console.error('[MiniSWEAgent] STEP 3: Generating system prompt...');
      this.logger.debug('Generating system prompt');
      const systemPrompt = this.promptGenerator.generateSystemPrompt({
        taskType: parsedTask.taskType,
        modelName: selection.selectedModel,
        domain: parsedTask.domain,
        context: input.context,
      });
      console.error(`[MiniSWEAgent] STEP 3 RESULT: systemPrompt length=${systemPrompt.length} chars`);

      // 4. Create execution request
      console.error('[MiniSWEAgent] STEP 4: Creating execution request...');
      const executionRequest: ExecutionRequest = {
        task: parsedTask,
        modelName: selection.selectedModel,
        systemPrompt,
        temperature: 0.7,
      };
      console.error(`[MiniSWEAgent] STEP 4 RESULT: request created for model=${executionRequest.modelName}`);

      // 5. Execute task with fallback
      console.error('[MiniSWEAgent] STEP 5: Executing task with fallback models...');
      this.logger.debug('Executing task', { model: selection.selectedModel });
      const fallbackModels = selection.alternatives.map(alt => alt.modelName);
      console.error(`[MiniSWEAgent] STEP 5: Primary model: ${selection.selectedModel}`);
      console.error(`[MiniSWEAgent] STEP 5: Fallback models: ${fallbackModels.join(', ')}`);
      const executionResult = await this.taskExecutor.executeWithFallback(
        executionRequest,
        fallbackModels
      );
      console.error(`[MiniSWEAgent] STEP 5 RESULT: execution completed, result type=${Array.isArray(executionResult) ? 'error array' : 'success'}`);

      // 6. Check if execution succeeded or failed
      let finalResult: ExecutionResult;

      if (Array.isArray(executionResult)) {
        // All models failed
        const errors = executionResult as ExecutionErrorType[];
        console.error(`[MiniSWEAgent] STEP 6: ALL MODELS FAILED`);
        console.error(`[MiniSWEAgent] STEP 6: Failed models: ${errors.map(e => e.modelAttempted).join(', ')}`);
        errors.forEach((err, idx) => {
          console.error(`[MiniSWEAgent] STEP 6: Error ${idx + 1}: ${err.modelAttempted} - ${err.error}`);
        });
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
        console.error(`[MiniSWEAgent] STEP 6: EXECUTION SUCCEEDED`);
        console.error(`[MiniSWEAgent] STEP 6: Model used: ${finalResult.modelUsed}`);
        console.error(`[MiniSWEAgent] STEP 6: Execution time: ${finalResult.executionTime}ms`);
        console.error(`[MiniSWEAgent] STEP 6: Confidence: ${finalResult.confidence}%`);
        this.logger.info('Task execution completed', {
          modelUsed: finalResult.modelUsed,
          executionTime: finalResult.executionTime,
          confidence: finalResult.confidence,
        });
      }

      // 7. Format and return result
      console.error('[MiniSWEAgent] STEP 7: Formatting result...');
      const formattedResult = this.resultFormatter.formatResult(
        parsedTask,
        selection,
        finalResult,
        this.logger.getLogs()
      );
      console.error('[MiniSWEAgent] ========== TASK EXECUTION END (SUCCESS) ==========');

      return formattedResult;
    } catch (error: any) {
      console.error('[MiniSWEAgent] ========== TASK EXECUTION END (ERROR) ==========');
      console.error(`[MiniSWEAgent] ERROR: ${error.message}`);
      console.error(`[MiniSWEAgent] STACK: ${error.stack}`);
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
