import React from 'react';
import { Card, Chip } from '@heroui/react';
import { Check } from 'lucide-react';
import { UISteps } from '@/types/ai-ui';

interface StepsProgressProps extends UISteps {}

export function StepsProgress({
  steps,
  currentStep,
}: StepsProgressProps) {
  const current = currentStep ?? 0;
  
  const getStepStatus = (index: number): 'completed' | 'current' | 'pending' => {
    if (index < current) return 'completed';
    if (index === current) return 'current';
    return 'pending';
  };
  
  const getStepColor = (status: string): any => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'current':
        return 'primary';
      default:
        return 'default';
    }
  };
  
  return (
    <Card className="max-w-2xl">
      <Card.Content>
        <div className="flex flex-col gap-4">
          {steps.map((step, index) => {
            const status = getStepStatus(index);
            
            return (
              <div
                key={index}
                className="flex flex-row items-start gap-3"
              >
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  status === 'completed' ? 'bg-success text-success-foreground' :
                  status === 'current' ? 'bg-primary text-primary-foreground' :
                  'bg-default-100 text-default-500'
                }`}>
                  {status === 'completed' ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </div>
                
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    status === 'current' ? 'text-foreground' : 'text-default-500'
                  }`}>
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-default-400 mt-1">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card.Content>
    </Card>
  );
}
