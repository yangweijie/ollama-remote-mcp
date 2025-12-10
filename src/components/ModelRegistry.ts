import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ModelProfile,
  ModelProfileConfig,
  ConfigurationError,
  TaskDomain,
  TaskComplexity,
} from '../types/index.js';

export class ModelRegistry {
  private profiles: Map<string, ModelProfile> = new Map();

  /**
   * Load model profiles from YAML configuration file
   */
  async loadProfiles(configPath: string): Promise<void> {
    try {
      const fileContent = await fs.readFile(configPath, 'utf-8');
      const config = this.parseYAML(fileContent);

      if (!config.models || typeof config.models !== 'object') {
        throw new ConfigurationError('Invalid configuration format: missing or invalid "models" field');
      }

      for (const [modelName, profileData] of Object.entries(config.models)) {
        try {
          const profile = this.validateAndCreateProfile(modelName, profileData);
          this.profiles.set(modelName, profile);
        } catch (error: any) {
          console.warn(`Skipping invalid model profile "${modelName}": ${error.message}`);
        }
      }

      if (this.profiles.size === 0) {
        throw new ConfigurationError('No valid model profiles found in configuration');
      }

      console.error(`Loaded ${this.profiles.size} model profiles from configuration`);
    } catch (error: any) {
      if (error instanceof ConfigurationError) {
        throw error;
      }
      throw new ConfigurationError(`Failed to load configuration from ${configPath}: ${error.message}`);
    }
  }

  /**
   * Verify model availability via Ollama Remote MCP
   * Note: This would integrate with the actual MCP client in production
   */
  async verifyAvailability(availableModels: string[]): Promise<void> {
    for (const [modelName, profile] of this.profiles.entries()) {
      profile.available = availableModels.includes(modelName);
    }

    const availableCount = Array.from(this.profiles.values()).filter(p => p.available).length;
    console.error(`${availableCount}/${this.profiles.size} models available on Ollama server`);
  }

  /**
   * Get a specific model profile
   */
  getProfile(modelName: string): ModelProfile | null {
    return this.profiles.get(modelName) || null;
  }

  /**
   * Get all model profiles
   */
  getAllProfiles(): ModelProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get only available model profiles
   */
  getAvailableProfiles(): ModelProfile[] {
    return Array.from(this.profiles.values()).filter(p => p.available);
  }

  /**
   * Simple YAML parser (basic implementation)
   * In production, use a proper YAML library like js-yaml
   */
  private parseYAML(content: string): ModelProfileConfig {
    try {
      // This is a simplified YAML parser for the specific structure we need
      // In production, use a library like 'js-yaml'
      const lines = content.split('\n');
      const config: ModelProfileConfig = { models: {} };
      
      let currentModel: string | null = null;
      let currentField: string | null = null;
      let indentLevel = 0;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const indent = line.search(/\S/);
        
        if (indent === 0 && trimmed === 'models:') {
          continue;
        }

        if (indent === 2 && trimmed.endsWith(':')) {
          currentModel = trimmed.slice(0, -1);
          config.models[currentModel] = {} as any;
          continue;
        }

        if (currentModel && indent === 4) {
          if (trimmed.startsWith('-')) {
            // Array item
            const value = trimmed.slice(1).trim();
            if (currentField) {
              if (!Array.isArray((config.models[currentModel] as any)[currentField])) {
                (config.models[currentModel] as any)[currentField] = [];
              }
              (config.models[currentModel] as any)[currentField].push(value);
            }
          } else if (trimmed.includes(':')) {
            // Key-value pair
            const [key, ...valueParts] = trimmed.split(':');
            const value = valueParts.join(':').trim();
            currentField = key.trim();
            
            if (value) {
              (config.models[currentModel] as any)[currentField] = this.parseValue(value);
            } else {
              (config.models[currentModel] as any)[currentField] = [];
            }
          }
        } else if (currentModel && indent === 6 && trimmed.startsWith('-')) {
          // Nested array item
          const value = trimmed.slice(1).trim();
          if (currentField && Array.isArray((config.models[currentModel] as any)[currentField])) {
            (config.models[currentModel] as any)[currentField].push(value);
          }
        }
      }

      return config;
    } catch (error: any) {
      throw new ConfigurationError(`Failed to parse YAML: ${error.message}`);
    }
  }

  /**
   * Parse YAML value to appropriate type
   */
  private parseValue(value: string): any {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (/^-?\d+$/.test(value)) return parseInt(value, 10);
    if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
    return value;
  }

  /**
   * Validate and create a model profile from configuration data
   */
  private validateAndCreateProfile(modelName: string, data: any): ModelProfile {
    const requiredFields = [
      'provider',
      'domains',
      'maxComplexity',
      'capabilities',
      'contextWindow',
      'estimatedLatency',
      'costPerToken',
      'strengths',
      'weaknesses',
    ];

    for (const field of requiredFields) {
      if (!(field in data)) {
        throw new ConfigurationError(`Missing required field: ${field}`);
      }
    }

    // Validate domains
    if (!Array.isArray(data.domains) || data.domains.length === 0) {
      throw new ConfigurationError('domains must be a non-empty array');
    }

    // Validate capabilities
    if (!Array.isArray(data.capabilities) || data.capabilities.length === 0) {
      throw new ConfigurationError('capabilities must be a non-empty array');
    }

    // Validate numeric fields
    if (typeof data.contextWindow !== 'number' || data.contextWindow <= 0) {
      throw new ConfigurationError('contextWindow must be a positive number');
    }
    if (typeof data.estimatedLatency !== 'number' || data.estimatedLatency < 0) {
      throw new ConfigurationError('estimatedLatency must be a non-negative number');
    }
    if (typeof data.costPerToken !== 'number' || data.costPerToken < 0) {
      throw new ConfigurationError('costPerToken must be a non-negative number');
    }

    // Validate complexity
    const validComplexities: TaskComplexity[] = ['simple', 'moderate', 'complex', 'expert'];
    if (!validComplexities.includes(data.maxComplexity)) {
      throw new ConfigurationError(`Invalid maxComplexity: ${data.maxComplexity}`);
    }

    return {
      name: modelName,
      provider: data.provider,
      domains: data.domains as TaskDomain[],
      maxComplexity: data.maxComplexity as TaskComplexity,
      capabilities: data.capabilities,
      contextWindow: data.contextWindow,
      estimatedLatency: data.estimatedLatency,
      costPerToken: data.costPerToken,
      strengths: data.strengths || [],
      weaknesses: data.weaknesses || [],
      available: false, // Will be set by verifyAvailability
    };
  }
}
