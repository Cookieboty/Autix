import React from 'react';
import { Card } from '@heroui/react';
import { Info } from 'lucide-react';
import { UICard, UIActionCallback } from '@/types/ai-ui';

interface InfoCardProps extends UICard, UIActionCallback {}

export function InfoCard({
  title,
  items,
  nestedCards,
  onAction,
  disabled,
}: InfoCardProps) {
  return (
    <Card className="max-w-2xl">
      {title && (
        <Card.Header className="flex gap-3">
          <Info className="w-5 h-5 text-primary" />
          <p className="text-base font-semibold">{title}</p>
        </Card.Header>
      )}
      
      <Card.Content className="space-y-4">
        {items && items.length > 0 && (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex justify-between gap-4">
                <span className="text-sm text-default-500">{item.label}</span>
                <span className="text-sm font-medium text-right">{item.value}</span>
              </div>
            ))}
          </div>
        )}
        
        {nestedCards && nestedCards.length > 0 && (
          <div className="space-y-3 mt-4">
            {nestedCards.map((card, index) => (
              <Card key={index} className="bg-default-100">
                <Card.Content>
                  {card.title && (
                    <p className="font-medium text-sm mb-3">{card.title}</p>
                  )}
                  {card.items && (
                    <div className="space-y-2">
                      {card.items.map((item, i) => (
                        <div key={i} className="flex justify-between gap-4">
                          <span className="text-sm text-default-500">{item.label}</span>
                          <span className="text-sm font-medium text-right">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card.Content>
              </Card>
            ))}
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
