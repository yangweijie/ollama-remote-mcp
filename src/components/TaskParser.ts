import {
  TaskParserInput,
  ParsedTask,
  TaskDomain,
  TaskComplexity,
  TaskType,
  ValidationError,
} from '../types/index.js';

export class TaskParser {
  /**
   * Parse a task input and extract its characteristics
   */
  parseTask(input: TaskParserInput): ParsedTask {
    // Validate task description
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
      taskType,
    };
  }

  /**
   * Validate task input
   */
  private validateTask(input: TaskParserInput): void {
    if (!input.description || input.description.trim().length === 0) {
      throw new ValidationError(
        'Task description cannot be empty or contain only whitespace'
      );
    }

    if (input.description.trim().length < 10) {
      throw new ValidationError(
        'Task description is too short. Please provide more detail (minimum 10 characters)'
      );
    }
  }

  /**
   * Detect task type from input or description
   */
  private detectTaskType(explicitType: string | undefined, description: string): TaskType {
    if (explicitType) {
      const normalizedType = this.normalizeTaskType(explicitType);
      if (normalizedType) return normalizedType;
    }

    // Detect from description
    const lowerDesc = description.toLowerCase();

    if (this.matchesPatterns(lowerDesc, ['generate', 'create', 'write code', 'implement'])) {
      return 'code_generation';
    }
    if (this.matchesPatterns(lowerDesc, ['bug', 'fix', 'error', 'issue', 'debug'])) {
      return 'bug_fixing';
    }
    if (this.matchesPatterns(lowerDesc, ['review', 'analyze code', 'check code', 'audit'])) {
      return 'code_review';
    }
    if (this.matchesPatterns(lowerDesc, ['test', 'unit test', 'testing', 'test case'])) {
      return 'test_writing';
    }
    if (this.matchesPatterns(lowerDesc, ['document', 'documentation', 'readme', 'doc'])) {
      return 'documentation';
    }
    if (this.matchesPatterns(lowerDesc, ['architecture', 'design', 'structure', 'system'])) {
      return 'architecture_analysis';
    }

    return 'general';
  }

  /**
   * Normalize task type string
   */
  private normalizeTaskType(type: string): TaskType | null {
    const typeMap: Record<string, TaskType> = {
      'code_generation': 'code_generation',
      'codegen': 'code_generation',
      'generate': 'code_generation',
      'bug_fixing': 'bug_fixing',
      'bugfix': 'bug_fixing',
      'fix': 'bug_fixing',
      'code_review': 'code_review',
      'review': 'code_review',
      'test_writing': 'test_writing',
      'test': 'test_writing',
      'testing': 'test_writing',
      'documentation': 'documentation',
      'docs': 'documentation',
      'architecture_analysis': 'architecture_analysis',
      'architecture': 'architecture_analysis',
      'design': 'architecture_analysis',
    };

    return typeMap[type.toLowerCase()] || null;
  }

  /**
   * Detect domain from description
   */
  private detectDomain(description: string, taskType: TaskType): TaskDomain {
    const lowerDesc = description.toLowerCase();

    // Task type hints
    if (['code_generation', 'bug_fixing', 'code_review', 'test_writing'].includes(taskType)) {
      return 'code';
    }

    // Content-based detection
    if (this.matchesPatterns(lowerDesc, ['math', 'calculate', 'formula', 'equation', 'proof'])) {
      return 'math';
    }
    if (this.matchesPatterns(lowerDesc, ['reason', 'logic', 'deduce', 'infer', 'conclude'])) {
      return 'reasoning';
    }
    if (this.matchesPatterns(lowerDesc, ['image', 'video', 'audio', 'visual', 'diagram'])) {
      return 'multimodal';
    }
    if (this.matchesPatterns(lowerDesc, ['code', 'function', 'class', 'api', 'program', 'script'])) {
      return 'code';
    }

    return 'general';
  }

  /**
   * Detect complexity level
   */
  private detectComplexity(description: string): TaskComplexity {
    const lowerDesc = description.toLowerCase();
    const length = description.length;

    // Expert level indicators
    if (
      this.matchesPatterns(lowerDesc, [
        'complex',
        'advanced',
        'sophisticated',
        'distributed',
        'scalable',
        'high-performance',
        'optimize',
        'refactor entire',
        'architectural',
      ])
    ) {
      return 'expert';
    }

    // Complex level indicators
    if (
      this.matchesPatterns(lowerDesc, [
        'multiple',
        'integrate',
        'system',
        'framework',
        'algorithm',
        'design pattern',
      ]) ||
      length > 500
    ) {
      return 'complex';
    }

    // Moderate level indicators
    if (
      this.matchesPatterns(lowerDesc, [
        'implement',
        'create',
        'build',
        'develop',
        'function',
        'class',
      ]) ||
      length > 200
    ) {
      return 'moderate';
    }

    // Simple by default
    return 'simple';
  }

  /**
   * Extract required capabilities
   */
  private extractCapabilities(
    description: string,
    taskType: TaskType,
    domain: TaskDomain
  ): string[] {
    const capabilities = new Set<string>();
    const lowerDesc = description.toLowerCase();

    // Domain-based capabilities
    if (domain === 'code') {
      capabilities.add('code_generation');
    }
    if (domain === 'math') {
      capabilities.add('math');
    }
    if (domain === 'reasoning') {
      capabilities.add('reasoning');
    }
    if (domain === 'multimodal') {
      capabilities.add('multimodal');
    }

    // Task type-based capabilities
    if (taskType === 'test_writing') {
      capabilities.add('testing');
    }
    if (taskType === 'bug_fixing') {
      capabilities.add('debugging');
    }

    // Content-based capabilities
    if (this.matchesPatterns(lowerDesc, ['tool', 'command', 'terminal', 'cli'])) {
      capabilities.add('tool_use');
    }
    if (this.matchesPatterns(lowerDesc, ['analyze', 'review', 'audit'])) {
      capabilities.add('code_analysis');
    }
    if (this.matchesPatterns(lowerDesc, ['explain', 'document', 'describe'])) {
      capabilities.add('explanation');
    }

    // Always include reasoning for non-simple tasks
    capabilities.add('reasoning');

    return Array.from(capabilities);
  }

  /**
   * Calculate context size in characters
   */
  private calculateContextSize(context?: string): number {
    if (!context) return 0;
    return context.length;
  }

  /**
   * Helper: Check if text matches any pattern
   */
  private matchesPatterns(text: string, patterns: string[]): boolean {
    return patterns.some((pattern) => text.includes(pattern));
  }
}
