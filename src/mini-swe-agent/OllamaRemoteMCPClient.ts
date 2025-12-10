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
    console.error(`[OllamaRemoteMCPClient.listModels] Fetching available models from ${this.baseUrl}`);
    try {
      const url = `${this.baseUrl.replace(/\/$/, '')}/api/tags`;
      console.error(`[OllamaRemoteMCPClient.listModels] URL: ${url}`);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      console.error(`[OllamaRemoteMCPClient.listModels] Sending GET request...`);
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      console.error(`[OllamaRemoteMCPClient.listModels] Response status: ${response.status}`);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      const models = data.models || [];
      console.error(`[OllamaRemoteMCPClient.listModels] Found ${models.length} models`);

      const modelNames = models.map((model: any) => model.name);
      console.error(`[OllamaRemoteMCPClient.listModels] Model names: ${modelNames.join(', ')}`);
      
      return modelNames;
    } catch (error: any) {
      console.error(`[OllamaRemoteMCPClient.listModels] ERROR: ${error.message}`);
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
    console.error(`[OllamaRemoteMCPClient.chat] ========== NETWORK REQUEST START ==========`);
    console.error(`[OllamaRemoteMCPClient.chat] Model: ${model}`);
    console.error(`[OllamaRemoteMCPClient.chat] Base URL: ${this.baseUrl}`);
    console.error(`[OllamaRemoteMCPClient.chat] Message length: ${message.length} chars`);
    console.error(`[OllamaRemoteMCPClient.chat] System prompt: ${systemPrompt ? 'yes' : 'no'}`);
    console.error(`[OllamaRemoteMCPClient.chat] Temperature: ${temperature || 0.7}`);

    try {
      const url = `${this.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
      console.error(`[OllamaRemoteMCPClient.chat] URL: ${url}`);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
        console.error(`[OllamaRemoteMCPClient.chat] API Key: configured`);
      } else {
        console.error(`[OllamaRemoteMCPClient.chat] API Key: not configured`);
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

      console.error(`[OllamaRemoteMCPClient.chat] Request body size: ${JSON.stringify(body).length} bytes`);
      console.error(`[OllamaRemoteMCPClient.chat] Sending POST request...`);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const elapsedTime = Date.now() - startTime;
      console.error(`[OllamaRemoteMCPClient.chat] Response received after ${elapsedTime}ms`);
      console.error(`[OllamaRemoteMCPClient.chat] Response status: ${response.status} ${response.statusText}`);
      console.error(`[OllamaRemoteMCPClient.chat] Response headers: Content-Type=${response.headers.get('content-type')}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[OllamaRemoteMCPClient.chat] ERROR RESPONSE BODY: ${errorText.substring(0, 500)}`);
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      console.error(`[OllamaRemoteMCPClient.chat] Parsing response JSON...`);
      const data = await response.json() as any;
      console.error(`[OllamaRemoteMCPClient.chat] Response parsed successfully`);
      console.error(`[OllamaRemoteMCPClient.chat] Response keys: ${Object.keys(data).join(', ')}`);

      const content = data.choices?.[0]?.message?.content || '';
      const tokensUsed = data.usage?.total_tokens;

      console.error(`[OllamaRemoteMCPClient.chat] Content length: ${content.length} chars`);
      console.error(`[OllamaRemoteMCPClient.chat] Tokens used: ${tokensUsed || 'unknown'}`);

      const executionTime = Date.now() - startTime;
      console.error(`[OllamaRemoteMCPClient.chat] Total execution time: ${executionTime}ms`);
      console.error(`[OllamaRemoteMCPClient.chat] ========== NETWORK REQUEST END (SUCCESS) ==========`);

      return {
        content,
        tokensUsed,
        executionTime,
      };
    } catch (error: any) {
      const elapsedTime = Date.now() - startTime;
      console.error(`[OllamaRemoteMCPClient.chat] ========== NETWORK REQUEST END (ERROR) ==========`);
      console.error(`[OllamaRemoteMCPClient.chat] Error after ${elapsedTime}ms: ${error.message}`);
      console.error(`[OllamaRemoteMCPClient.chat] Error stack: ${error.stack}`);
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
