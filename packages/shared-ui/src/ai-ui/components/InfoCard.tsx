'use client';

import React from 'react';
import { Card, CardHeader, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Info, ChevronRight } from 'lucide-react';
import { UICard, UIActionCallback } from '@autix/shared-lib';

interface InfoCardProps extends UICard, UIActionCallback {}

export function InfoCard({
  title,
  items,
  nestedCards,
  onAction,
  disabled,
}: InfoCardProps) {
  const hasHighlight = items?.some(item => item.highlight !== undefined && item.highlight !== null);
  const isActionList = hasHighlight;

  return (
    <Card className="max-w-2xl">
      {title && (
        <CardHeader className="flex gap-3">
          <Info className="w-5 h-5 text-primary" />
          <p className="text-base font-semibold">{title}</p>
        </CardHeader>
      )}

      <CardContent className="space-y-4">
        {items && items.length > 0 && (
          <div className="space-y-3">
            {isActionList ? (
              items.map((item, index) => (
                <Button
                  key={index}
                  variant={item.highlight ? "secondary" : "ghost"}
                  onClick={() => onAction('select', { action: item.value, label: item.label })}
                  disabled={disabled}
                  className="w-full justify-between"
                >
                  <span className="text-sm">{item.label}</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ))
            ) : (
              items.map((item, index) => (
                <div key={index} className="flex justify-between gap-4">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-medium text-right">{item.value}</span>
                </div>
              ))
            )}
          </div>
        )}

        {nestedCards && nestedCards.length > 0 && (
          <div className="space-y-3 mt-4">
            {nestedCards.map((card, index) => (
              <Card key={index} className="bg-muted">
                <CardContent>
                  {card.title && (
                    <p className="font-medium text-sm mb-3">{card.title}</p>
                  )}
                  {card.items && (
                    <div className="space-y-2">
                      {card.items.map((item, i) => (
                        <div key={i} className="flex justify-between gap-4">
                          <span className="text-sm text-muted-foreground">{item.label}</span>
                          <span className="text-sm font-medium text-right">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
