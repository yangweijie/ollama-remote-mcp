import { SystemPromptConfig, TaskType, TaskDomain } from '../types/index.js';

export class SystemPromptGenerator {
  /**
   * Generate task-specific system prompt
   */
  generateSystemPrompt(config: SystemPromptConfig): string {
    const basePrompt = this.getBasePrompt();
    const taskSpecific = this.getTaskSpecificPrompt(config.taskType);
    const domainGuidance = this.getDomainGuidance(config.domain);
    const contextInclusion = config.context ? this.formatContext(config.context) : '';

    return [basePrompt, taskSpecific, domainGuidance, contextInclusion]
      .filter(Boolean)
      .join('\n\n');
  }

  /**
   * Base prompt for all tasks
   */
  private getBasePrompt(): string {
    return `You are an expert software engineering assistant. Your role is to provide accurate, well-reasoned, and actionable solutions to software engineering tasks. Follow best practices, write clean code, and explain your reasoning when appropriate.`;
  }

  /**
   * Get task-type-specific prompt
   */
  private getTaskSpecificPrompt(taskType: TaskType): string {
    const prompts: Record<TaskType, string> = {
      code_generation: this.getCodeGenerationPrompt(),
      bug_fixing: this.getBugFixingPrompt(),
      code_review: this.getCodeReviewPrompt(),
      test_writing: this.getTestWritingPrompt(),
      documentation: this.getDocumentationPrompt(),
      architecture_analysis: this.getArchitectureAnalysisPrompt(),
      general: this.getGeneralPrompt(),
    };

    return prompts[taskType] || prompts.general;
  }

  private getCodeGenerationPrompt(): string {
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

  private getBugFixingPrompt(): string {
    return `TASK: Bug Fixing

Guidelines:
- Identify the root cause of the issue, not just symptoms
- Provide a clear explanation of what went wrong
- Suggest a minimal, targeted fix that doesn't introduce new issues
- Consider edge cases that might trigger similar bugs
- Recommend tests to prevent regression
- Explain why the fix works and what it changes`;
  }

  private getCodeReviewPrompt(): string {
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

  private getTestWritingPrompt(): string {
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

  private getDocumentationPrompt(): string {
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

  private getArchitectureAnalysisPrompt(): string {
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

  private getGeneralPrompt(): string {
    return `TASK: General Software Engineering

Guidelines:
- Provide accurate and well-reasoned solutions
- Consider best practices and industry standards
- Explain your reasoning clearly
- Address potential edge cases and limitations
- Suggest alternatives when appropriate`;
  }

  /**
   * Get domain-specific guidance
   */
  private getDomainGuidance(domain: TaskDomain): string {
    const guidance: Partial<Record<TaskDomain, string>> = {
      code: 'Focus on code quality, correctness, and maintainability. Use appropriate data structures and algorithms.',
      math: 'Ensure mathematical accuracy. Show your work and explain formulas. Verify calculations.',
      reasoning: 'Use clear logical steps. Make assumptions explicit. Consider alternative perspectives.',
      multimodal: 'Consider all provided inputs (text, images, etc.). Explain visual elements clearly.',
    };

    return guidance[domain] || '';
  }

  /**
   * Format context for inclusion in prompt
   */
  private formatContext(context: string): string {
    return `CONTEXT:
${context}

Use the above context to inform your response.`;
  }
}
