import {
  ParsedTask,
  ModelProfile,
  ModelScore,
  SelectionResult,
  TaskComplexity,
  AvailabilityError,
} from '../types/index.js';
import { ModelRegistry } from './ModelRegistry.js';

export class ModelSelector {
  private registry: ModelRegistry;

  constructor(registry: ModelRegistry) {
    this.registry = registry;
  }

  /**
   * Select the best model for a given task
   */
  selectModel(task: ParsedTask): SelectionResult {
    const availableProfiles = this.registry.getAvailableProfiles();

    if (availableProfiles.length === 0) {
      throw new AvailabilityError(
        'No models available. Please ensure Ollama Remote MCP is running and models are configured.'
      );
    }

    // Score all available models
    const scores = availableProfiles.map(profile => this.scoreModel(task, profile));

    // Sort by score (descending), then by latency (ascending) for tie-breaking
    scores.sort((a, b) => {
      if (Math.abs(a.score - b.score) < 0.01) {
        // Tie: prefer faster model
        return a.latencyScore - b.latencyScore;
      }
      return b.score - a.score;
    });

    const selectedScore = scores[0];
    const alternatives = scores.slice(1, 4); // Top 3 alternatives

    const reasoning = this.generateReasoning(task, selectedScore, alternatives);

    return {
      selectedModel: selectedScore.modelName,
      score: selectedScore,
      alternatives,
      reasoning,
    };
  }

  /**
   * Score a model against task requirements
   * 
   * Scoring weights:
   * - Domain Match: 30%
   * - Complexity Match: 25%
   * - Capability Match: 25%
   * - Context Match: 10%
   * - Latency Score: 10%
   */
  private scoreModel(task: ParsedTask, profile: ModelProfile): ModelScore {
    const domainMatch = this.calculateDomainMatch(task, profile);
    const complexityMatch = this.calculateComplexityMatch(task, profile);
    const capabilityMatch = this.calculateCapabilityMatch(task, profile);
    const contextMatch = this.calculateContextMatch(task, profile);
    const latencyScore = this.calculateLatencyScore(profile);

    const totalScore =
      domainMatch * 0.3 +
      complexityMatch * 0.25 +
      capabilityMatch * 0.25 +
      contextMatch * 0.1 +
      latencyScore * 0.1;

    const justification = this.generateJustification(
      profile,
      domainMatch,
      complexityMatch,
      capabilityMatch,
      contextMatch,
      latencyScore
    );

    return {
      modelName: profile.name,
      score: Math.round(totalScore * 100) / 100,
      domainMatch: Math.round(domainMatch * 100) / 100,
      complexityMatch: Math.round(complexityMatch * 100) / 100,
      capabilityMatch: Math.round(capabilityMatch * 100) / 100,
      contextMatch: Math.round(contextMatch * 100) / 100,
      latencyScore: Math.round(latencyScore * 100) / 100,
      justification,
    };
  }

  /**
   * Calculate domain match score (0-100)
   */
  private calculateDomainMatch(task: ParsedTask, profile: ModelProfile): number {
    if (profile.domains.includes(task.domain)) {
      return 100;
    }

    // Partial matches
    if (task.domain === 'general' || profile.domains.includes('general')) {
      return 50;
    }

    // Code domain can partially handle reasoning
    if (task.domain === 'reasoning' && profile.domains.includes('code')) {
      return 40;
    }

    return 0;
  }

  /**
   * Calculate complexity match score (0-100)
   */
  private calculateComplexityMatch(task: ParsedTask, profile: ModelProfile): number {
    const complexityLevels: TaskComplexity[] = ['simple', 'moderate', 'complex', 'expert'];
    const taskLevel = complexityLevels.indexOf(task.complexity);
    const modelLevel = complexityLevels.indexOf(profile.maxComplexity);

    if (modelLevel >= taskLevel) {
      // Model can handle this complexity
      return 100;
    } else {
      // Model might struggle with this complexity
      const gap = taskLevel - modelLevel;
      return Math.max(0, 100 - gap * 30);
    }
  }

  /**
   * Calculate capability match score (0-100)
   */
  private calculateCapabilityMatch(task: ParsedTask, profile: ModelProfile): number {
    if (task.requiredCapabilities.length === 0) {
      return 100;
    }

    const matchedCapabilities = task.requiredCapabilities.filter(cap =>
      profile.capabilities.includes(cap)
    );

    const matchPercentage = (matchedCapabilities.length / task.requiredCapabilities.length) * 100;
    return matchPercentage;
  }

  /**
   * Calculate context window match score (0-100)
   */
  private calculateContextMatch(task: ParsedTask, profile: ModelProfile): number {
    const estimatedTaskSize = task.description.length + task.contextSize;

    if (estimatedTaskSize <= profile.contextWindow * 0.5) {
      // Well within limit
      return 100;
    } else if (estimatedTaskSize <= profile.contextWindow * 0.8) {
      // Comfortable fit
      return 80;
    } else if (estimatedTaskSize <= profile.contextWindow) {
      // Tight fit
      return 60;
    } else {
      // Exceeds context window
      return 0;
    }
  }

  /**
   * Calculate latency score (0-100, lower latency = higher score)
   */
  private calculateLatencyScore(profile: ModelProfile): number {
    // Normalize latency (assuming 10000ms is very slow, 1000ms is very fast)
    const maxLatency = 10000;
    const minLatency = 1000;

    const normalizedLatency = Math.min(
      Math.max(profile.estimatedLatency, minLatency),
      maxLatency
    );

    // Invert score so lower latency = higher score
    const score = 100 - ((normalizedLatency - minLatency) / (maxLatency - minLatency)) * 100;
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate justification for a model score
   */
  private generateJustification(
    profile: ModelProfile,
    domainMatch: number,
    complexityMatch: number,
    capabilityMatch: number,
    contextMatch: number,
    latencyScore: number
  ): string {
    const parts: string[] = [];

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

    return parts.join(', ');
  }

  /**
   * Generate selection reasoning
   */
  private generateReasoning(
    task: ParsedTask,
    selectedScore: ModelScore,
    alternatives: ModelScore[]
  ): string {
    const parts: string[] = [];

    parts.push(
      `Selected ${selectedScore.modelName} with score ${selectedScore.score.toFixed(1)}/100`
    );

    parts.push(
      `Task characteristics: ${task.domain} domain, ${task.complexity} complexity, ` +
      `requires [${task.requiredCapabilities.join(', ')}]`
    );

    parts.push(`Scoring breakdown: ${selectedScore.justification}`);

    if (alternatives.length > 0) {
      const altList = alternatives
        .map(alt => `${alt.modelName} (${alt.score.toFixed(1)})`)
        .join(', ');
      parts.push(`Alternative models considered: ${altList}`);
    }

    return parts.join('. ') + '.';
  }
}
