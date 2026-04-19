import { useState, useCallback } from 'react';
import { createAIUIClient } from '@/lib/ai-ui-api';
import { useAIUIStore } from '@/store/ai-ui.store';
import { UIAction } from '@/types/ai-ui';

export function useSSEChat(conversationId: string) {
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { 
    addMessage, 
    updateStreamingMessage, 
    finalizeStreaming,
    setStage,
  } = useAIUIStore();
  
  const sendMessage = useCallback(async (
    message: string | UIAction,
    modelId?: string,
  ) => {
    setError(null);
    setIsLoading(true);
    
    if (typeof message === 'string') {
      addMessage({
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date(),
      });
    } else {
      addMessage({
        id: `user-${Date.now()}`,
        role: 'user',
        content: `[操作: ${message.action}]`,
        timestamp: new Date(),
      });
    }
    
    try {
      const client = createAIUIClient();
      const stream = client.sendMessage(conversationId, message, modelId);
      
      for await (const event of stream) {
        switch (event.type) {
          case 'ui-event':
            updateStreamingMessage('', event.data);
            break;
            
          case 'text':
            updateStreamingMessage((event.raw || '') + '\n');
            break;
            
          case 'summary':
            if (event.data?.uiStage) {
              setStage(event.data.uiStage);
            }
            break;
            
          case 'done':
            finalizeStreaming();
            break;
            
          case 'error':
            throw new Error('服务器返回错误');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, addMessage, updateStreamingMessage, finalizeStreaming, setStage]);
  
  return { sendMessage, error, isLoading };
}
