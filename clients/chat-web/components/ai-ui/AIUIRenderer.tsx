import React from 'react';
import { UIResponse } from '@/types/ai-ui';
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
  onAction: (componentId: string, action: string, data: Record<string, unknown>) => void;
  disabled?: boolean;
}

export function AIUIRenderer({ components, onAction, disabled }: AIUIRendererProps) {
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
      {filteredComponents.map((component) => {
        const key = component.componentId;
        const actionProps = { 
          onAction: (action: string, data: Record<string, unknown>) => 
            handleAction(component.componentId, action, data),
          disabled 
        };
        
        switch (component.type) {
          case 'text':
            return <TextMessage key={key} {...component} />;
            
          case 'selection':
            return <SelectionCard key={key} {...component} {...actionProps} />;
            
          case 'form':
            return <DynamicForm key={key} {...component} {...actionProps} />;
            
          case 'confirmation':
            return <ConfirmDialog key={key} {...component} {...actionProps} />;
            
          case 'card':
            return <InfoCard key={key} {...component} {...actionProps} />;
            
          case 'steps':
            return <StepsProgress key={key} {...component} />;
            
          case 'table':
            return <DataTable key={key} {...component} {...actionProps} />;
            
          case 'action_buttons':
            return <ActionButtons key={key} {...component} {...actionProps} />;
            
          default:
            console.warn('Unknown component type:', (component as any).type);
            return null;
        }
      })}
    </div>
  );
}
