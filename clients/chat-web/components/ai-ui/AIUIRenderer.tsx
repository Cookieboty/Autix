import React from 'react';
import type { UIResponse, ComponentInteractionState } from '@/types/ai-ui';
import { TextMessage } from './components/TextMessage';
import { SelectionCard } from './components/SelectionCard';
import { DynamicForm } from './components/DynamicForm';
import { ConfirmDialog } from './components/ConfirmDialog';
import { InfoCard } from './components/InfoCard';
import { StepsProgress } from './components/StepsProgress';
import { DataTable } from './components/DataTable';
import { ActionButtons } from './components/ActionButtons';

interface AIUIRendererProps {
  components: UIResponse[];
  thinking?: string;
  interactionState?: ComponentInteractionState;
  onAction: (componentId: string, action: string, data: Record<string, unknown>) => void;
  disabled?: boolean;
}

export function AIUIRenderer({ 
  components, 
  thinking,
  interactionState = {}, 
  onAction, 
  disabled 
}: AIUIRendererProps) {
  // Filter out action_buttons when form is present (form has built-in buttons)
  const hasForm = components.some(c => c.type === 'form');
  const filteredComponents = hasForm 
    ? components.filter(c => c.type !== 'action_buttons')
    : components;
  
  const handleAction = (componentId: string, action: string, data: Record<string, unknown>) => {
    onAction(componentId, action, data);
  };
  
  return (
    <div className="space-y-4">
      {thinking && (
        <div
          className="px-4 py-3 rounded-md"
          style={{
            backgroundColor: 'var(--info-bg)',
            border: '1px solid var(--info-border)',
            color: 'var(--info-foreground)',
          }}
        >
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              style={{ color: 'var(--accent)' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 text-sm whitespace-pre-wrap">
              {thinking}
            </div>
          </div>
        </div>
      )}
      
      {filteredComponents.map((component, idx) => {
        const key = component.componentId;
        const componentState = interactionState[component.componentId];
        const isDisabled = disabled || componentState?.disabled || false;
        
        const actionProps = { 
          onAction: (action: string, data: Record<string, unknown>) => 
            handleAction(component.componentId, action, data),
          disabled: isDisabled
        };
        
        switch (component.type) {
          case 'text':
            return <TextMessage key={key} {...component} />;
            
          case 'selection':
            return (
              <SelectionCard
                key={key}
                {...component}
                {...actionProps}
                selectedValue={componentState?.data?.selectedValue}
              />
            );
            
          case 'form':
            return (
              <DynamicForm 
                key={key} 
                {...component} 
                {...actionProps}
                submittedData={componentState?.data}
              />
            );
            
          case 'confirmation':
            return (
              <ConfirmDialog
                key={key}
                {...component}
                {...actionProps}
                confirmedAction={componentState?.action}
              />
            );
            
          case 'card':
            return <InfoCard key={key} {...component} {...actionProps} />;
            
          case 'steps':
            return <StepsProgress key={key} {...component} />;
            
          case 'table':
            return <DataTable key={key} {...component} {...actionProps} />;
            
          case 'action_buttons':
            return (
              <ActionButtons
                key={key}
                {...component}
                {...actionProps}
                executedAction={componentState?.action}
              />
            );
            
          default:
            console.warn('Unknown component type:', (component as any).type);
            return null;
        }
      })}
    </div>
  );
}
