import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { createAIUIClient } from '@autix/sdk';
import { useAIUIStore } from '@autix/shared-store';
import type { UIAction } from '@autix/shared-store';

export function useSSEChat(conversationId: string) {
  const t = useTranslations('aiUi');
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
        content: t('actionMessage', { action: message.action }),
        timestamp: new Date(),
      });
    }
    
    try {
      const client = createAIUIClient();
      const stream = client.sendMessage(conversationId, message, modelId);
      
      for await (const event of stream) {
        switch (event.type) {
          case 'ui-event':
            updateStreamingMessage('', event.data as never);
            break;
            
          case 'text':
            updateStreamingMessage((event.raw || '') + '\n');
            break;
            
          case 'summary': {
            const summary = event.data as { uiStage?: string } | undefined;
            if (summary?.uiStage) {
              setStage(summary.uiStage as never);
            }
            break;
          }
            
          case 'done':
            finalizeStreaming();
            break;
            
          case 'error':
            throw new Error(t('serverError'));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, addMessage, updateStreamingMessage, finalizeStreaming, setStage, t]);
  
  return { sendMessage, error, isLoading };
}
