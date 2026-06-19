'use client';

import React from 'react';
import { Card, CardContent } from '../../ui/card';
import { Check } from 'lucide-react';
import type { UISteps } from '@autix/shared-store';

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

  return (
    <Card className="max-w-2xl">
      <CardContent>
        <div className="flex flex-col gap-4">
          {steps.map((step, index) => {
            const status = getStepStatus(index);

            return (
              <div
                key={index}
                className="flex flex-row items-start gap-3"
              >
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  status === 'completed' ? 'bg-green-500 text-white' :
                  status === 'current' ? 'bg-primary text-primary-foreground' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {status === 'completed' ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </div>

                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    status === 'current' ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
