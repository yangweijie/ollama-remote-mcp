import {
  FormattedResult,
  ParsedTask,
  SelectionResult,
  ExecutionResult,
  ExecutionLog,
} from '../types/index.js';

export class ResultFormatter {
  /**
   * Format execution result into structured output
   */
  formatResult(
    task: ParsedTask,
    selection: SelectionResult,
    execution: ExecutionResult,
    logs: ExecutionLog[]
  ): FormattedResult {
    return {
      task: {
        description: task.description,
        domain: task.domain,
        complexity: task.complexity,
        requiredCapabilities: task.requiredCapabilities,
        contextSize: task.contextSize,
        taskType: task.taskType,
      },
      execution: {
        modelUsed: execution.modelUsed,
        executionTime: execution.executionTime,
        tokensUsed: execution.tokensUsed,
        confidence: execution.confidence,
      },
      selection: {
        selectedModel: selection.selectedModel,
        justification: selection.reasoning,
        alternatives: selection.alternatives,
      },
      result: {
        response: execution.response,
        metadata: execution.metadata,
      },
      logs,
    };
  }

  /**
   * Format result as JSON string
   */
  toJSON(result: FormattedResult): string {
    return JSON.stringify(result, null, 2);
  }

  /**
   * Format result as human-readable text
   */
  toText(result: FormattedResult): string {
    const parts: string[] = [];

    parts.push('=== Mini-SWE Agent Execution Result ===\n');

    // Task Information
    parts.push('TASK:');
    parts.push(`  Type: ${result.task.taskType}`);
    parts.push(`  Domain: ${result.task.domain}`);
    parts.push(`  Complexity: ${result.task.complexity}`);
    parts.push(`  Description: ${result.task.description}`);
    parts.push('');

    // Model Selection
    parts.push('MODEL SELECTION:');
    parts.push(`  Selected: ${result.selection.selectedModel}`);
    parts.push(`  Justification: ${result.selection.justification}`);
    if (result.selection.alternatives.length > 0) {
      parts.push('  Alternatives:');
      result.selection.alternatives.forEach((alt) => {
        parts.push(`    - ${alt.modelName} (score: ${alt.score.toFixed(1)})`);
      });
    }
    parts.push('');

    // Execution Results
    parts.push('EXECUTION:');
    parts.push(`  Model Used: ${result.execution.modelUsed}`);
    parts.push(`  Execution Time: ${result.execution.executionTime}ms`);
    parts.push(`  Tokens Used: ${result.execution.tokensUsed}`);
    parts.push(`  Confidence: ${result.execution.confidence}%`);
    parts.push('');

    // Response
    parts.push('RESPONSE:');
    parts.push(result.result.response);
    parts.push('');

    return parts.join('\n');
  }

  /**
   * Format error result
   */
  formatError(
    task: ParsedTask,
    error: string,
    logs: ExecutionLog[]
  ): FormattedResult {
    return {
      task: {
        description: task.description,
        domain: task.domain,
        complexity: task.complexity,
        requiredCapabilities: task.requiredCapabilities,
        contextSize: task.contextSize,
        taskType: task.taskType,
      },
      execution: {
        modelUsed: 'none',
        executionTime: 0,
        tokensUsed: 0,
        confidence: 0,
      },
      selection: {
        selectedModel: 'none',
        justification: 'Task execution failed',
        alternatives: [],
      },
      result: {
        response: '',
        metadata: {
          error,
          success: false,
        },
      },
      logs,
    };
  }
}
