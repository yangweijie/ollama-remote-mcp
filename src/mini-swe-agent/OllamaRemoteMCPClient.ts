import { OllamaClient } from '../components/TaskExecutor.js';

/**
 * Ollama Remote MCP Client implementation
 * Integrates with the existing Ollama Remote MCP server
 */
export class OllamaRemoteMCPClient implements OllamaClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.apiKey = apiKey || process.env.OLLAMA_API_KEY || '';
  }

  /**
   * List available models on the Ollama server
   */
  async listModels(): Promise<string[]> {
    try {
      const url = `${this.baseUrl.replace(/\/$/, '')}/api/tags`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      const models = data.models || [];

      return models.map((model: any) => model.name);
    } catch (error: any) {
      console.error('Failed to list Ollama models:', error.message);
      return [];
    }
  }

  /**
   * Chat with a model
   */
  async chat(
    model: string,
    message: string,
    systemPrompt?: string,
    temperature?: number
  ): Promise<{
    content: string;
    tokensUsed?: number;
    executionTime?: number;
  }> {
    const startTime = Date.now();

    try {
      const url = `${this.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const body = {
        model: model,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: message },
        ],
        stream: false,
        options: {
          temperature: temperature || 0.7,
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content || '';
      const tokensUsed = data.usage?.total_tokens;

      const executionTime = Date.now() - startTime;

      return {
        content,
        tokensUsed,
        executionTime,
      };
    } catch (error: any) {
      throw new Error(`Failed to chat with model ${model}: ${error.message}`);
    }
  }

  /**
   * Test connection to Ollama server
   */
  async testConnection(): Promise<boolean> {
    try {
      const models = await this.listModels();
      return models.length > 0;
    } catch (error) {
      return false;
    }
  }
}
