import type { UIAction, SSEEvent } from './ai-ui-types';
import { authFetch, getApiBaseUrl, getValidAccessToken } from './client-core';

export class AIUIClient {
  private baseUrl: string;
  private getToken: () => Promise<string | null>;

  constructor(baseUrl: string, getToken: () => Promise<string | null>) {
    this.baseUrl = baseUrl;
    this.getToken = getToken;
  }

  async *sendMessage(
    conversationId: string,
    message: string | UIAction,
    modelId?: string,
  ): AsyncGenerator<SSEEvent> {
    const token = await this.getToken();
    if (!token) throw new Error('Not logged in');

    const url = `${this.baseUrl}/api/conversations/${conversationId}/chat`;

    const response = await authFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, modelId }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const data = line.slice(6);

          if (data === '[DONE]') {
            yield { type: 'done' };
            continue;
          }
          if (data === '[ERROR]') {
            yield { type: 'error' };
            continue;
          }

          try {
            const json = JSON.parse(data);
            if (json.type === 'ui-event') {
              yield { type: 'ui-event', data: json };
            } else if (json.type === 'summary') {
              yield { type: 'summary', data: json };
            } else {
              yield { type: 'text', raw: data };
            }
          } catch {
            if (data.trim()) {
              yield { type: 'text', raw: data };
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export function createAIUIClient(): AIUIClient {
  return new AIUIClient(getApiBaseUrl(), () => getValidAccessToken());
}
