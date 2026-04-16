import { UIAction, SSEEvent } from '@/types/ai-ui';

export class AIUIClient {
  private baseUrl: string;
  private getToken: () => string | null;
  
  constructor(baseUrl: string, getToken: () => string | null) {
    this.baseUrl = baseUrl;
    this.getToken = getToken;
  }
  
  async *sendMessage(
    conversationId: string,
    message: string | UIAction,
    modelId?: string,
  ): AsyncGenerator<SSEEvent> {
    const token = this.getToken();
    if (!token) throw new Error('未登录');
    
    const url = `${this.baseUrl}/api/conversations/${conversationId}/chat`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
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

export function createAIUIClient() {
  const baseUrl = process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://localhost:4001';
  const getToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  };
  
  return new AIUIClient(baseUrl, getToken);
}
